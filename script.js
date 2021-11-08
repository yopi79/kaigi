//Peerモデルを定義
const Peer = window.Peer;

(async function main() {
  //操作がDOMを取得
  const localVideo = document.getElementById('js-local-stream');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const micTrigger = document.getElementById('js-mic-trigger');
  const videoTrigger = document.getElementById('js-video-trigger');
  const shareTrigger = document.getElementById('js-shere-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomId = document.getElementById('js-room-id');
  const roomMode = document.getElementById('js-room-mode');
  const localText = document.getElementById('js-local-text');
  const localName = document.getElementById('js-local-name');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');
  var mic=true;
  var video=true;
  

  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

  //同時接続モードがSFUなのかMESHなのかをここで設定
  const getRoomModeByHash = () => (location.hash === '#sfu' ? 'sfu' : 'mesh');
  //divタグに接続モードを挿入
  roomMode.textContent = getRoomModeByHash();
  //接続モードの変更を感知するリスナーを設置
  window.addEventListener(
    'hashchange',
    () => (roomMode.textContent = getRoomModeByHash())
  );

  //自分の映像と音声をlocalStreamに代入
  const localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .catch(console.error);

  // localStreamをdiv(localVideo)に挿入
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);
  //ビデオ・マイクをデフォルトでoffにする
  localStream.getVideoTracks().forEach((video) => (video.enabled = false));
  localStream.getAudioTracks().forEach((track) => (track.enabled = false));


  // Peerのインスタンス作成
  const peer = (window.peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));

  // 「div(joinTrigger)が押される＆既に接続が始まっていなかったら接続」するリスナー設置
  joinTrigger.addEventListener('click', () => {
    if (!peer.open) {
      return;
    }
    //部屋に接続するメソッド（joinRoom）
    const room = peer.joinRoom(roomId.value, {
      mode: getRoomModeByHash(),
      stream: localStream,
    });
    //部屋に接続できた時（open）に一度だけdiv(messages)に=== You joined ===を表示
    room.once('open', () => {
      messages.textContent += '=== You joined ===\n';
    });
    //部屋に誰かが接続してきた時（peerJoin）、div(messages)に下記のテキストを表示
    room.on('peerJoin', peerId => {
      messages.textContent += `=== ${peerId} joined ===\n`;
    });

    //重要：streamの内容に変更があった時（stream）videoタグを作って流す
    room.on('stream', async stream => {
      const newVideo = document.createElement('video');
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      // 誰かが退出した時どの人が退出したかわかるように、data-peer-idを付与
      newVideo.setAttribute('data-peer-id', stream.peerId);
      remoteVideos.append(newVideo);
      await newVideo.play().catch(console.error);
    });

    //重要：誰かがテキストメッセージを送った時、messagesを更新
    room.on('data', ({ data }) => {
      messages.textContent += `${data}\n`;
    });

     // 誰かが退出した場合、div（remoteVideos）内にある、任意のdata-peer-idがついたvideoタグの内容を空にして削除する
    room.on('peerLeave', peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id="${peerId}"]`
      );
      //videoストリームを止める上では定番の書き方らしい。https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();

      messages.textContent += `=== ${peerId} left ===\n`;
    });

     // 自分が退出した場合の処理
    room.once('close', () => {
      //メッセージ送信ボタンを押せなくする
      sendTrigger.removeEventListener('click', onClickSend);
      //messagesに== You left ===\nを表示
      messages.textContent += '== You left ===\n';
      //remoteVideos以下の全てのvideoタグのストリームを停めてから削除
      Array.from(remoteVideos.children).forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
    });

    // ボタン（sendTrigger）を押すとonClickSendを発動
    sendTrigger.addEventListener('click', onClickSend);
    // ボタン（leaveTrigger）を押すとroom.close()を発動
    leaveTrigger.addEventListener('click', () => room.close(), { once: true });
    micTrigger.addEventListener('click', muted);
    videoTrigger.addEventListener('click', videoff);
    //shareTrigger.addEventListener('click', shareDisplay);

    //テキストメッセージを送る処理
    function onClickSend() {
      room.send(localName.value+": "+localText.value);
      messages.textContent += `${localName.value}: ${localText.value}\n`;
      localText.value = '';
    }
    function muted() {
      // 音声のみミュート
      if(mic){
        localStream.getAudioTracks().forEach((track) => (track.enabled = true));
        document.getElementById("js-mic-trigger").innerHTML='<img src="img/micon.png">';
        mic=false;
      }
      else{
        localStream.getAudioTracks().forEach((track) => (track.enabled = false));
        document.getElementById("js-mic-trigger").innerHTML='<img src="img/micoff.png">';
        mic=true;
      }
    }
    function videoff() {
      //ビデオのみミュート
      if(video){
        localStream.getVideoTracks().forEach((video) => (video.enabled = true));
        document.getElementById("js-video-trigger").innerHTML='<img src="img/videon.png">';
        video=false;
      }
      //カメラオン
      else{
        localStream.getVideoTracks().forEach((video) => (video.enabled = false));
        document.getElementById("js-video-trigger").innerHTML='<img src="img/videoff.png">';
        video=true;
      }
    }

      //以下画面共有(できない)
    function handleSuccess(stream) {
      startButton.disabled = true;
      const video = document.querySelector('video');
      video.srcObject = stream;
    
      // demonstrates how to detect that the user has stopped
      // sharing the screen via the browser UI.
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        errorMsg('The user has ended sharing the screen');
        startButton.disabled = false;
      });
    }
    
    function handleError(error) {
      errorMsg(`getDisplayMedia error: ${error.name}`, error);
    }
    
    function errorMsg(msg, error) {
      const errorElement = document.querySelector('#errorMsg');
      errorElement.innerHTML += `<p>${msg}</p>`;
      if (typeof error !== 'undefined') {
        console.error(error);
      }
    }
    
    const startButton = document.getElementById('js-share-trigger');
    startButton.addEventListener('click', () => {
      navigator.mediaDevices.getDisplayMedia({video: true})
          .then(handleSuccess, handleError);
    });
    
    if ((navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices)) {
      startButton.disabled = false;
    } else {
      errorMsg('getDisplayMedia is not supported');
    }
  })
  peer.on('error', console.error);
})();

//画面共有
// Polyfill in Firefox.
// See https://blog.mozilla.org/webrtc/getdisplaymedia-now-available-in-adapter-js/
// if (adapter.browserDetails.browser == 'firefox') {
//   adapter.browserShim.shimGetDisplayMedia(window, 'screen');
// }

