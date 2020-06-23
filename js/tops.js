/* jshint curly:true, debug:true */
/* globals $, firebase */
// 現在ログインしているユーザID
let currentUID;

// Firebaseから取得したデータを一時保存しておくための変数
let dbdata = {};

/**
 * -------------------
 * 服一覧画面関連の関数
 * -------------------
 */

// 服の表紙画像をダウンロードする
const downloadClothImage = clothImageLocation => firebase
  .storage()
  .ref(clothImageLocation)
  .getDownloadURL() // cloth-images/abcdef のようなパスから画像のダウンロードURLを取得
  .catch((error) => {
    console.error('写真のダウンロードに失敗:', error);
  });

// 服の表紙画像を表示する
const displayClothImage = ($divTag, url) => {
  $divTag.find('.cloth-item__image').attr({
    src: url,
  });
};

// Realtime Database の clothes から服を削除する
const deleteCloth = (clothId) => {
  // TODO: clothes から該当の服データを削除
  firebase
    .database()
    .ref(`Clothes/${currentUID}/Tops`)
    .child(clothId)
    .remove();
};

// 服の表示用のdiv（jQueryオブジェクト）を作って返す
const createClothDiv = (clothId, clothData) => {
  // HTML内のテンプレートからコピーを作成する
  const $divTag = $('#cloth-template > .cloth-item').clone();

  // 服タイトルを表示する
  $divTag.find('.cloth-item__title').text(clothData.clothTitle);

  // 服の表紙画像をダウンロードして表示する
  downloadClothImage(clothData.clothImageLocation).then((url) => {
    displayClothImage($divTag, url);
  });

  // id属性をセット
  $divTag.attr('id', `cloth-id-${clothId}`);

  // 削除ボタンのイベントハンドラを登録
  const $deleteButton = $divTag.find('.cloth-item__delete');
  $deleteButton.on('click', () => {
    deleteCloth(clothId);
  });

  return $divTag;
};

// 服一覧画面内の服データをクリア
const resetClosetView = () => {
  $('#cloth-list').empty();
};

// 服一覧画面に服データを表示する
const addCloth = (clothId, clothData) => {
  const $divTag = createClothDiv(clothId, clothData);
  $divTag.appendTo('#cloth-list');
  console.log('服を追加しました');
};

// 服一覧画面の初期化、イベントハンドラ登録処理
const loadClosetView = () => {
  resetClosetView();

  // 服データを取得
  const clothesRef = firebase
    .database()
    .ref(`Clothes/${currentUID}/Tops`)
    .orderByChild('createdAt');

  // 過去に登録したイベントハンドラを削除
  clothesRef.off('child_removed');
  clothesRef.off('child_added');

  // clothes の child_removedイベントハンドラを登録
  // （データベースから服が削除されたときの処理）
  clothesRef.on('child_removed', (clothSnapshot) => {
    const clothId = clothSnapshot.key;
    const $cloth = $(`#cloth-id-${clothId}`);

    // TODO: 服一覧画面から該当の服データを削除する
    $cloth.remove();

  });

  // clothes の child_addedイベントハンドラを登録
  // （データベースに服が追加保存されたときの処理）
  clothesRef.on('child_added', (clothSnapshot) => {
    const clothId = clothSnapshot.key;
    const clothData = clothSnapshot.val();

    // 服一覧画面に服データを表示する
    addCloth(clothId, clothData);
  });
};

/**
 * ----------------------
 * すべての画面共通で使う関数
 * ----------------------
 */

// ビュー（画面）を変更する
const showView = (id) => {
  $('.view').hide();
  $(`#${id}`).fadeIn(1500);

  if (id === 'closet') {
    loadClosetView().fadeIn();
  }
};

/**
 * -------------------------
 * ログイン・ログアウト関連の関数
 * -------------------------
 */


// ログインした直後に呼ばれる
const onLogin = () => {
  console.log('ログイン完了');
  

  // 服一覧画面を表示
  showView('closet');
};

// ログアウトした直後に呼ばれる
const onLogout = () => {
  const clothesRef = firebase.database().ref('Clothes');
  firebase
    .database()
    .ref('users')
    .off('value');
    
  // 過去に登録したイベントハンドラを削除
  clothesRef.off('child_removed');
  clothesRef.off('child_added');
  showView('login');
};


/**
 * ---------------------------------------
 * 以下、コールバックやイベントハンドラの登録と、
 * ページ読み込みが完了したタイミングで行うDOM操作
 * ---------------------------------------
 */

/**
 * --------------------
 * ログイン・ログアウト関連
 * --------------------
 */


// ログイン状態の変化を監視する
firebase.auth().onAuthStateChanged((user) => {
  // ログイン状態が変化した

  if (user) {
    // ログイン済
    currentUID = user.uid;
    onLogin();
  } else {
    // 未ログイン
    currentUID = null;
    onLogout();
  }
});


// ログアウトがクリックされたらログアウトする
$('.logout-button').on('click', (e) => {
  e.preventDefault();

  firebase
    .auth()
    .signOut()
    .then(() => {
      // ログアウト成功
      location.href='../index.html';
    })
    .catch((error) => {
      console.error('ログアウトに失敗:', error);
    });
});

/**
 * -------------------------
 * 服情報追加モーダル関連の処理
 * -------------------------
 */

// 服の登録モーダルを初期状態に戻す
const resetAddClothModal = () => {
  $('#cloth-form')[0].reset();
  $('#add-cloth-image-label').text('');
  $('#submit_add_cloth')
    .prop('disabled', false)
    .text('保存する');
};

// 選択した表紙画像の、ファイル名を表示する
$('#add-cloth-image').on('change', (e) => {
  const input = e.target;
  const $label = $('#add-cloth-image-label');
  const file = input.files[0];

  if (file != null) {
    $label.text(file.name);
  } else {
    $label.text('ファイルを選択');
  }
});

// 服の登録処理
$('#cloth-form').on('submit', (e) => {
  e.preventDefault();

  // 服の登録ボタンを押せないようにする
  $('#submit_add_cloth')
    .prop('disabled', true)
    .text('送信中…');

  // 服タイトル
  const clothName = $('#add-cloth-title').val();

  const $clothImage = $('#add-cloth-image');
  const { files } = $clothImage[0];

  if (files.length === 0) {
    // ファイルが選択されていないなら何もしない
    return;
  }

  const file = files[0]; // 表紙画像ファイル
  const filename = file.name; // 画像ファイル名
  const clothImageLocation = `tops-images/${currentUID}/${filename}`; // 画像ファイルのアップロード先

  // 服データを保存する
  firebase
    .storage()
    .ref(clothImageLocation)
    .put(file) // Storageへファイルアップロードを実行
    .then(() => {
      // Storageへのアップロードに成功したら、Realtime Databaseに服データを保存する
      const clothData = {
        clothName,
        clothImageLocation,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
      };
      return firebase
        .database()
        .ref(`Clothes/${currentUID}/Tops`)
        .push(clothData);
    })
    .then(() => {
      // 服一覧画面の服の登録モーダルを閉じて、初期状態に戻す
      $('#add-cloth-modal').modal('hide');
      resetAddClothModal();
    })
    .catch((error) => {
      // 失敗したとき
      console.error('エラー', error);
      resetAddClothModal();
      $('#add-cloth__help')
        .text('保存できませんでした。')
        .fadeIn();
    });
});







/**
 * 
 * usersを作成
 * 
 * */


// ユーザ一覧を取得してさらに変更を監視
const usersRef = firebase.database().ref('users');
// 過去に登録したイベントハンドラを削除
usersRef.off('value');
// イベントハンドラを登録
usersRef.on('value', (usersSnapshot) => {
  // usersに変更があるとこの中が実行される

  dbdata.users = usersSnapshot.val();

  // 自分のユーザデータが存在しない場合は作成
  if (dbdata.users === null || !dbdata.users[currentUID]) {
    const { currentUser } = firebase.auth();
    if (currentUser) {
      console.log('ユーザデータを作成します');
      firebase
        .database()
        .ref(`users/${currentUID}`)
        .set({
          nickname: currentUser.email,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          updatedAt: firebase.database.ServerValue.TIMESTAMP,
        });

      // このコールバック関数が再度呼ばれるのでこれ以上は処理しない
      return;
    }
  }

});