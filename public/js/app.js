const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const call = document.getElementById("call");
const filterSelect = document.getElementById("filter");
const video = window.video = document.querySelector('video');

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let name;
let myPeerConnection;
let myDataChannel;
let dataChannels = [];

// 미디어 스트림을 가져오는 함수
async function getMedia() {
  const constraints = {
    audio: true,
    video: true
  };

  try {
    myStream = await navigator.mediaDevices.getUserMedia(constraints);
    // myStream = await navigator.mediaDevices.getUserMedia(constraints).then(handleSuccess).catch(handleError);
    myFace.srcObject = myStream;
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
    muteBtn.innerText = "마이크 차단";
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
  video.className = filterSelect.value;
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

// 웹 소켓 이벤트 처리 부분
socket.on("welcome", async (room, _name) => {
  makeConnection(_name);
  console.log("welcome 수신");
  //원격 유저와 연결하는 신규 채널을 생성
  myDataChannel = myPeerConnection.createDataChannel("chat");

  myDataChannel.onmessage = function (event) {
    console.log(event.data);
    appendMessage(event.data, false);
  };

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
  console.log("캔디데이트 수신");
  if (ice){
    myPeerConnection.addIceCandidate(ice);
  }
});

socket.on("leave_room", (name, hostName) => {
  console.log(name);
  removeUserByTag(name);
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

  // 나머지 코드는 이전과 동일합니다.
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", (event) => {
    handleAddStream(event, _name);
  });

  myStream
      .getTracks()
      .forEach((track) => myPeerConnection.addTrack(track, myStream));

}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data, _name) {
  console.log("addstream" + data);

  // "peerFace" 요소를 생성합니다.
  const peerFace = document.createElement("video");
  peerFace.autoplay = true;
  peerFace.playsinline = true;
  peerFace.width = 400;
  peerFace.height = 400;

  // "peerFace" 요소에 스트림을 설정합니다.
  peerFace.srcObject = data.stream;
  peerFace.dataset.tag = _name;

  // "peerFaceContainer" 부모 요소에 "peerFace"를 추가합니다.
  const peerFaceContainer = document.getElementById("peerFaceContainer");
  peerFaceContainer.appendChild(peerFace);
}

window.onbeforeunload = function () {
  socket.emit("leave_room", roomName, name);
}

function removeUserByTag(tag) {
  const peerFaceContainer = document.getElementById("peerFaceContainer");
  const peerFaces = peerFaceContainer.querySelectorAll("video");
  peerFaces.forEach((peerFace) => {
    if (peerFace.dataset.tag === tag) {
      peerFaceContainer.removeChild(peerFace);
    }
  });
}

const msgForm = document.querySelector("form#msgForm");
const messageContainer = document.getElementById("message-container");

msgForm.addEventListener("submit", function (event) {
  event.preventDefault();

  // Get the user's message from the input field
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

  appendMessage(text, true);

  // Clear the input field after sending the message
  userMessageInput.value = "";
});

function appendMessage(text, isCurrentUser) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");

  // Set inner HTML with sender, timestamp, and text
  messageElement.innerHTML = formatMessage(text,isCurrentUser)

  // Append the message to the message container
  messageContainer.appendChild(messageElement);
}

function formatMessage(text, isCurrentUser) {
  const messageType = text.substr(0, 2);
  const message = text.substr(2);
  const messageParts = message.split("::");
  const messageContent = messageParts[1];
  const nameContent = messageParts[0];
  const timeContent = messageParts[2];

  // Format the message based on messageType or customize as needed
  switch (messageType) {
    case "-s":
      return `<div class="message-content  ${isCurrentUser ? 'user-message' : 'other-message'}"><strong>${nameContent} :</strong> <span class="received-message">${messageContent}</span> ${timeContent}</div>`;
    default:
      return text;
  }
}
