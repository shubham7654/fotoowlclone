Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("./models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("./models"),
]).then(() => startVideo());

let currentStream = null;
let videoDevices = [];
let currentDeviceIndex = 0;

async function startVideo(deviceId = null) {

  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
}

const constraints = {
    video: deviceId ? { deviceId: { exact: deviceId } } : true
};

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    const video = document.getElementById("video");
    video.srcObject = currentStream;
  } catch (err) {
    console.error("Camera access error:", err);
    document.getElementById("status").innerText = "❌ Camera access denied!";
  }
}

async function getCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices = devices.filter((device) => device.kind === "videoinput");
  console.log("Available cameras:", videoDevices);
}

document.getElementById("switchCamera").addEventListener("click", async () => {
  if (videoDevices.length > 1) {
    currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
    await startVideo(videoDevices[currentDeviceIndex].deviceId);
  } else {
    alert("No other camera found!");
  }
});

async function checkFrontProfile() {
  const video = document.getElementById("video");
  const statusText = document.getElementById("status");

  if (!video || video.readyState < 2) {
    requestAnimationFrame(checkFrontProfile); // Retry if video not ready
    return;
  }

  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks();

  if (!detection) {
    statusText.innerText =
      "⚠️ No face detected! Please position yourself properly.";
    requestAnimationFrame(checkFrontProfile);
    return;
  }

  const landmarks = detection.landmarks;
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const nose = landmarks.getNose();
  const jaw = landmarks.getJawOutline();

  const eyeDistance = Math.abs(leftEye[0].x - rightEye[3].x);
  const noseMid = nose[3].x;
  const faceMid = (jaw[0].x + jaw[jaw.length - 1].x) / 2;
  const tolerance = 10;

  const isFrontFacing = checkFrontFacing(leftEye, rightEye, nose);

  if (isFrontFacing) {
    statusText.innerText = "✅ Front-facing profile detected!";
  } else if (!isFrontFacing) {
    statusText.innerText = "✅ Side profile detected!";
  } else {
    statusText.innerText = "❌ Face not detected! Adjust your position.";
  }

  function checkFrontFacing(leftEye, rightEye, nose) {
    // Calculate average x-coordinates of eyes
    const leftEyeX =
      leftEye.reduce((sum, pt) => sum + pt.x, 0) / leftEye.length;
    const rightEyeX =
      rightEye.reduce((sum, pt) => sum + pt.x, 0) / rightEye.length;
    const noseX = nose.reduce((sum, pt) => sum + pt.x, 0) / nose.length;

    // If nose is centered between the eyes, the face is front-facing
    const eyeCenter = (leftEyeX + rightEyeX) / 2;
    const tolerance = 10; // Allow slight variation
    return Math.abs(noseX - eyeCenter) < tolerance;
  }

  requestAnimationFrame(checkFrontProfile);
}

window.onload = async function () {
  await startVideo(videoDevices.length > 0 ? videoDevices[0].deviceId : null);
  await getCameras();
  requestAnimationFrame(checkFrontProfile);
};
