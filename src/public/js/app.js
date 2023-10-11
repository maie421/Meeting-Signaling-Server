const socket = new WebSocket("ws://localhost:3000");

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

// Function to retrieve camera device information
async function getCameras() {
  try {
    // Media device list
    const devices = await navigator.mediaDevices.enumerateDevices();
    // Filter only camera devices
    const cameras = devices.filter((device) => device.kind === "videoinput");
    // Camera currently in use
    const currentCamera = myStream.getVideoTracks()[0];
    // configure camera selection list
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

// Function to get media stream
async function getMedia(deviceId) {
  const initialConstraints = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
        deviceId ? cameraConstraints : initialConstraints
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

// Function to process when the microphone mute button is clicked
function handleMuteClick() {
  myStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerText = "Unmute";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
}

// Function processed when clicking the camera switch button
function handleCameraClick() {
  myStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerText = "Turn Camera Off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    cameraOff = true;
  }
}

// Function to process when camera selection changes
async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection.getSenders().find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

// Register microphone mute button event listener
muteBtn.addEventListener("click", handleMuteClick);
// Register camera switch button event listener
cameraBtn.addEventListener("click", handleCameraClick);
// Register camera selection change event listener
camerasSelect.addEventListener("input", handleCameraChange);

// Handles welcome message and room joining
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

// call start function
async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

// Welcome message form submission processing function
async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  // join room
  socket.send(JSON.stringify({ type: "join_room", roomName: input.value }));
  roomName = input.value;
  input.value = "";
}

// Register welcome message form submission event listener
welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Websocket event processing part
socket.onmessage = function (event) {
  const message = JSON.parse(event.data);
  if (message.type === "welcome") {
    // Create a new channel to connect to a remote user
    myDataChannel = myPeerConnection.createDataChannel("chat");
    myDataChannel.addEventListener("message", (event) => console.log(event.data));
    // Create offer creator connection setting information
    myPeerConnection.createOffer()
        .then(function (offer) {
          // Set offer creator connection settings
          myPeerConnection.setLocalDescription(offer);
          socket.send(JSON.stringify({ type: "offer", offer: offer, roomName: roomName }));
        });
  } else if (message.type === "offer") {
    myPeerConnection.addEventListener("datachannel", (event) => {
      // Set the data channel when a data channel event occurs
      myDataChannel = event.channel;
      myDataChannel.addEventListener("message", (event) => console.log(event.data));
    });
    // Set the offer connection settings of the offer creator
    myPeerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
    // Create sensor connection settings information
    myPeerConnection.createAnswer()
        .then(function (answer) {
          // Enter connection setup
          myPeerConnection.setLocalDescription(answer);
          socket.send(JSON.stringify({ type: "answer", answer: answer, roomName: roomName }));
        });
  } else if (message.type === "answer") {
    // Set the answer connection settings of the offer creator.
    myPeerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
  } else if (message.type === "ice") {
    console.log("Candy date received");
    myPeerConnection.addIceCandidate(new RTCIceCandidate(message.ice));
  }
};

function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    // Helps connect between peers
    iceServers: [
      {
        // Public IP address and port available in the network environment
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
  myStream.getTracks().forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(event) {
  console.log("sent candidate");
  socket.send(JSON.stringify({ type: "ice", ice: event.candidate, roomName: roomName }));
}

function handleAddStream(event) {
  const peerFace = document.getElementById("peerFace");
  peerFace.srcObject = event.stream;
}
