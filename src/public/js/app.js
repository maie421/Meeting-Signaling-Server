const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let myDataChannel;

// 카메라 디바이스 정보를 가져오는 함수
async function getCameras() {
  try {
    // 미디어 디바이스 목록
    const devices = await navigator.mediaDevices.enumerateDevices();
    // 카메라 디바이스만 필터링
    const cameras = devices.filter((device) => device.kind === "videoinput");
    // 현재 사용 중인 카메라
    const currentCamera = myStream.getVideoTracks()[0];
    // 카메라 선택 목록을 구성
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

// 미디어 스트림을 가져오는 함수
async function getMedia(deviceId) {
  const initialConstrains = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
        deviceId ? cameraConstraints : initialConstrains
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
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
    muteBtn.innerText = "마이크 켜기";
    muted = true;
  } else {
    muteBtn.innerText = "마이크 끄기";
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

// 카메라 선택 변경 시 처리하는 함수
async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
        .getSenders()
        .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

// 마이크 음소거 버튼 이벤트 리스너 등록
muteBtn.addEventListener("click", handleMuteClick);
// 카메라 전환 버튼 이벤트 리스너 등록
cameraBtn.addEventListener("click", handleCameraClick);
// 카메라 선택 변경 이벤트 리스너 등록
camerasSelect.addEventListener("input", handleCameraChange);

// 환영 메시지와 방 참가를 처리하는 부분
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

// 통화 시작 함수
async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

// 환영 메시지 폼 제출 처리 함수
async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  // 방 참가
  socket.emit("join_room", input.value);
  roomName = input.value;
  input.value = "";
}

// 환영 메시지 폼 제출 이벤트 리스너 등록
welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// 웹 소켓 이벤트 처리 부분
socket.on("welcome", async () => {
  //원격 유저와 연결하는 신규 채널을 생성
  myDataChannel = myPeerConnection.createDataChannel("chat");
  myDataChannel.addEventListener("message", (event) => console.log(event.data));
  //오퍼 생성자 연결설정 정보 생성
  const offer = await myPeerConnection.createOffer();
  //오퍼 생성자 연결설정 설정
  myPeerConnection.setLocalDescription(offer);
  socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    // 데이터 채널 이벤트가 발생하면 데이터 채널을 설정
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", (event) =>
        console.log(event.data)
    );
  });
  //오퍼생성자의 오퍼 연결 설정을 설정
  myPeerConnection.setRemoteDescription(offer);
  //엔서 연결설정 설정 정보 생성
  const answer = await myPeerConnection.createAnswer();
  //엔서 연결 설정
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
});

socket.on("answer", (answer) => {
  // 오퍼생성자의 앤서 연결 설정을 설정합니다.
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("캔디데이트 수신");
  myPeerConnection.addIceCandidate(ice);
});

function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    //피어 간 연결 할 수 있도록 도와 주는 것
    iceServers: [
      {
        //네트워크 환경에서 사용 가능한 공인 IP 주소, 포트
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  });

  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleAddStream);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  const peerFace = document.getElementById("peerFace");
  peerFace.srcObject = data.stream;
}
