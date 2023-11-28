const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const call = document.getElementById("call");
const filterSelect = document.getElementById("filter");
const recordText = document.querySelector(`#recordText`);
const captureScreenButton = document.getElementById("captureScreen");
const stopCaptureScreenButton = document.getElementById("stopCaptureScreen");
const localVideo = document.getElementById("local-video");

call.hidden = true;

let double;
let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let name;
let myPeerConnection;
let myDataChannel;
let dataChannels = [];
let videoSender = [];
let peerConnections= [];
const VIDEO = "ARDAMSv0";
let mediaStream = null;
// 미디어 스트림을 가져오는 함수
async function getMedia() {
  const constraints = {
    audio: true,
    video: true
  };

  try {
    myStream = await navigator.mediaDevices.getUserMedia(constraints);
    setup();
  } catch (e) {
    console.log(e);
  }
}

// 마이크 음소거 버튼 클릭 시 처리하는 함수
function handleMuteClick() {
  myStream
      .getAudioTracks()
      .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerText = "마이크 끄기";
    muted = true;
  } else {
    muteBtn.innerText = "마이크 켜기";
    muted = false;
  }
}

// 카메라 전환 버튼 클릭 시 처리하는 함수
function handleCameraClick() {
  myStream
      .getVideoTracks()
      .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerText = "카메라 끄기";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "카메라 켜기";
    cameraOff = true;
  }
}

// 마이크 음소거 버튼 이벤트 리스너 등록
muteBtn.addEventListener("click", handleMuteClick);
// 카메라 전환 버튼 이벤트 리스너 등록
cameraBtn.addEventListener("click", handleCameraClick);
filterSelect.addEventListener("change", handleFilterSelect);

function handleFilterSelect() {
  myFace.className = filterSelect.value;
  switch (filterSelect.value){
    case 'invert':
      fragColor = "gl_FragColor = vec4(vec3(1.0) - color, 1.0);";
      break;
    default:
      fragColor = "gl_FragColor = vec4(color, 1.0);";
      break;

  }
  // fragColor = 'gl_FragColor = vec4(color * vec3(0.9, 0.0, 1.0), 1.0);';
  console.log(fragColor);
  update();

  const videoTrack = newStream.getVideoTracks()[0];
  console.log(videoTrack);

  videoSender.forEach(function (_sender) {
    _sender.replaceTrack(videoTrack);
  })
}
// 환영 메시지와 방 참가를 처리하는 부분
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form#welcomeForm");

// 통화 시작 함수
async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  // makeConnection();
}

// 환영 메시지 폼 제출 처리 함수
async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector(`#room_name`);
  const inputName = welcomeForm.querySelector(`#name`);
  await initCall();
  // 방 참가
  socket.emit("join_room", input.value, inputName.value);
  roomName = input.value;
  name = inputName.value;
  input.value = "";
}

// 환영 메시지 폼 제출 이벤트 리스너 등록
welcomeForm.addEventListener("submit", handleWelcomeSubmit);
socket.on("stop_screen_room", (roomName, name) => {
  const peerFaceContainer = document.getElementById("peerFaceContainer");
  const peerFaces = peerFaceContainer.querySelectorAll("video");

  console.log("stop_screen_room" + name);

  removeUserByTag(name);

  peerFaces.forEach((peerFace) => {
    if (peerFace.dataset.tag === name+"_화면공유") {
      peerFace.dataset.tag = name;
    }
  });
});
// 웹 소켓 이벤트 처리 부분
socket.on("welcome", async (room, _name) => {
  makeConnection(_name);
  console.log("welcome 수신");
  //원격 유저와 연결하는 신규 채널을 생성
  myDataChannel = myPeerConnection.createDataChannel("chat");

  if (recordText.style.display === 'block') {
    socket.emit("recorder_name", roomName, _name);
  }

  myDataChannel.onmessage = function (event) {
    console.log(event.data);
    double = event.data;
    appendMessage(event.data, false);
  };

  if (name.includes('화면공유')){
    appendMessage(`[${name}] 님이 방에 참가했습니다.`, false);
  }

  dataChannels.push(myDataChannel);
  //오퍼 생성자 연결설정 정보 생성
  const offer = await myPeerConnection.createOffer();
  //오퍼 생성자 연결설정 설정
  myPeerConnection.setLocalDescription(offer);
  socket.emit("offer", offer, roomName, _name, name);
});

socket.on("offer", async (offer, sendName, socketId, receiverName, host) => {
  console.log("offer");
  makeConnection(receiverName);

  myPeerConnection.addEventListener("datachannel", (event) => {
    // 데이터 채널 이벤트가 발생하면 데이터 채널을 설정
    myDataChannel = event.channel;
    dataChannels.push(myDataChannel);

    myDataChannel.onmessage = function (event) {
      console.log(event.data);
      double = event.data;
      appendMessage(event.data, false);
    };
  });
  //오퍼생성자의 오퍼 연결 설정을 설정
  myPeerConnection.setRemoteDescription(offer);
  //엔서 연결설정 설정 정보 생성
  const answer = await myPeerConnection.createAnswer();
  //엔서 연결 설정
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName, sendName, socketId);
});
socket.on("answer", (answer, sendName) => {
  console.log("answer 수신");
  // 오퍼생성자의 앤서 연결 설정을 설정합니다.
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  if (ice){
    myPeerConnection.addIceCandidate(ice);
  }
});
socket.on("send_web_message", (msg) => {
  if (double !== msg){
    appendMessage(msg, false);
  }
});
socket.on("leave_room", (name, hostName) => {
  console.log(name);
  appendMessage(`[${name}] 님이 방에서 나갔습니다.`, false);
  removeUserByTag(name);
});
socket.on("recorder_name", () => {
  recordText.style.display = "block";
});

socket.on("recorder_room", () => {
  recordText.style.display = "block";
});
socket.on("stop_recorder_room", () => {
  recordText.style.display = "none";
});
function makeConnection(_name) {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302", // STUN 서버 정보
      },
      {
        urls: "turn:15.165.75.15:3478",
        username: "username1",
        credential: "key1",
      },
    ],
  });

  myPeerConnection.addEventListener("icecandidate", handleIce);

  myPeerConnection.onaddstream = (event) => {
    handleAddStream(event, _name);
  };

  peerConnections.push(myPeerConnection);

  if (stopCaptureScreenButton.style.display === 'block') {
    mediaStream.getTracks()
        .forEach((track) => {
          myPeerConnection.addTrack(track, mediaStream);
        });
  }else{
    myStream
        .getTracks()
        .forEach((track) => myPeerConnection.addTrack(track, myStream));
  }
}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(stream, _name) {
  // "peerFace" 요소를 생성합니다.
  const peerFace = document.createElement("video");
  let isPeerFace = false;
  peerFace.autoplay = true;
  peerFace.playsinline = true;
  peerFace.width = 400;
  peerFace.height = 400;

  // "peerFace" 요소에 스트림을 설정합니다.
  peerFace.srcObject = event.stream;
  peerFace.dataset.tag = _name;

  const peerFaceContainer = document.getElementById("peerFaceContainer");
  const peerFaces = peerFaceContainer.querySelectorAll("video");
  peerFaces.forEach((peerFace) => {
    if (peerFace.dataset.tag === _name) {
      isPeerFace = true;
    }
  });
  console.log("isPeerFace:" + isPeerFace);
  if (!isPeerFace){
    peerFaceContainer.appendChild(peerFace);

    videoSender.push(myPeerConnection
        .getSenders()
        .find((sender) => sender.track.kind === "video"));
  }
}

window.onbeforeunload = function () {
  if (recordText.style.display === 'block'){
    socket.emit("stop_recorder_room", roomName);
  }
  if (stopCaptureScreenButton.style.display === 'block') {
    stopCaptureScreen();
    socket.emit("stop_screen_room", roomName, name);
  }
  socket.emit("leave_room", roomName, name);
}

function removeUserByTag(tag) {
  const peerFaceContainer = document.getElementById("peerFaceContainer");
  const peerFaces = peerFaceContainer.querySelectorAll("video");

  peerFaces.forEach((peerFace) => {
    if (peerFace.dataset.tag === tag || peerFace.dataset.tag === tag+"_화면공유") {
      peerFaceContainer.removeChild(peerFace);
    }
  });
}

const msgForm = document.querySelector("form#msgForm");
const messageContainer = document.getElementById("message-container");

msgForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const userMessageInput = msgForm.querySelector("input[type='text']");
  const userMessage = userMessageInput.value;

  const timestamp = new Date();
  const hours = timestamp.getHours().toString().padStart(2, '0');
  const minutes = timestamp.getMinutes().toString().padStart(2, '0');
  const timestampString = `${hours}시${minutes}분`;

  const text = `-s${name}::${userMessage}::${timestampString}`;

  dataChannels.forEach(function (_myDataChannel) {
    console.log(`send ${text}`);
    // const encodedData = stringToByteBuffer(text, 'utf-8');
    if (_myDataChannel.readyState === 'open') {
      _myDataChannel.send(text);
    }
  });

  socket.emit("send_android_message", roomName, text);
  appendMessage(text, true);

  userMessageInput.value = "";
});

function appendMessage(text, isCurrentUser) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");

  messageElement.innerHTML = formatMessage(text, isCurrentUser)
  messageContainer.appendChild(messageElement);
}

function formatMessage(text, isCurrentUser) {
  const messageType = text.substr(0, 2);
  const message = text.substr(2);
  const messageParts = message.split("::");
  const messageContent = messageParts[1];
  const nameContent = messageParts[0];
  const timeContent = messageParts[2];

  switch (messageType) {
    case "-s":
      return `<div class="message-content  ${isCurrentUser ? 'user-message' : 'other-message'}"><strong>${nameContent} :</strong> <span class="received-message">${messageContent}</span> ( ${timeContent} )</div>`;
    default:
      return text;
  }
}

const buffer = document.createElement('canvas');
const canvas = document.getElementById('canvas');
let newStream = canvas.captureStream();

let glslCanvas;

let fragColor = `gl_FragColor = vec4(color, 1.0);`;

function setup() {
  canvas.style.display = 'none';
  myFace.srcObject = myStream;
  myFace.play();

  window.devicePixelRatio = 1;

  update();
}

function render() {
  buffer.width = myFace.videoWidth;
  buffer.height = myFace.videoHeight;
  buffer.getContext('2d').drawImage(myFace, 0, 0);

  canvas.width = myFace.width;
  canvas.height = myFace.height;

  if (!glslCanvas) {
    glslCanvas = new GlslCanvas(canvas);
    update();
  }

  var dataURL = buffer.toDataURL();
  glslCanvas.setUniform('u_texture', dataURL);

  window.requestAnimationFrame(render);
}

function update() {
  const vertexShader = `
    #ifdef GL_ES
    precision mediump float;
    #endif
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_time;
    void main() {
      vec2 st = gl_FragCoord.xy / u_resolution.xy;
      float x = gl_FragCoord.x;
      float y = gl_FragCoord.y;
      vec3 color = texture2D(u_texture, st).rgb;
      ${fragColor}
    }
  `;

  if (glslCanvas) glslCanvas.load(vertexShader);
}

// myFace.addEventListener('play', function() {
//   (function loop() {
//     render();
//   })();
// }, 0);


// 화면 공유
captureScreenButton.addEventListener("click", captureScreen);
stopCaptureScreenButton.addEventListener("click", stopCaptureScreen)
async function captureScreen() {
  try {
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: "always"
      },
      audio: false
    });

    mediaStream.onstop = (event) => {
      console.log("스크린샷 종료")
      stopCaptureScreen();
    };

    localVideo.srcObject = mediaStream;

    const videoTrack = mediaStream.getVideoTracks()[0];

    videoSender.forEach(function (_sender) {
      _sender.replaceTrack(videoTrack);
    });

    localVideo.style.display = "block";
    myFace.style.display = "none"
    captureScreenButton.style.display = "none";
    stopCaptureScreenButton.style.display = "block";

  } catch (ex) {
    console.log("Error occurred", ex);
  }
}
function stopCaptureScreen(){
  const tracks = mediaStream.getTracks();
  tracks.forEach(track => track.stop());
  mediaStream = null;
  captureScreenButton.style.display = "block";
  myFace.style.display = "block"
  stopCaptureScreenButton.style.display = "none";
  localVideo.style.display= "none";

  const videoTrack = myStream.getVideoTracks()[0];
  videoSender.forEach(function (_sender) {
    _sender.replaceTrack(videoTrack);
  });
}