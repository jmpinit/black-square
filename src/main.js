/* global THREEx */
const THREE = require('three');
const EventEmitter = require('events').EventEmitter;
const get = require('./get');

function interfaceUser() {
  const uiRenderer = new EventEmitter();

  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setClearColor(new THREE.Color('lightgrey'), 0);

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0px';
  renderer.domElement.style.left = '0px';

  document.body.appendChild(renderer.domElement);

  // Initialize scene and camera
  const scene = new THREE.Scene();

  const ambient = new THREE.AmbientLight(0x666666);
  scene.add(ambient);

  const directionalLight = new THREE.DirectionalLight(0x887766);
  directionalLight.position.set(-1, 1, 1).normalize();
  scene.add(directionalLight);

  // Initialize a basic camera

  // Create a camera
  const camera = new THREE.Camera();
  scene.add(camera);

  // Handle arToolkitSource

  const arToolkitSource = new THREEx.ArToolkitSource({ sourceType: 'webcam' });

  // Handle resize

  arToolkitSource.init(() => arToolkitSource.onResize(renderer.domElement));

  window.addEventListener('resize', () => arToolkitSource.onResize(renderer.domElement));

  // Initialize arToolkitContext

  // Create atToolkitContext
  const arToolkitContext = new THREEx.ArToolkitContext({
    cameraParametersUrl: '/data/camera_para.dat',
    detectionMode: 'mono',
    maxDetectionRate: 30,
    canvasWidth: 80 * 3,
    canvasHeight: 60 * 3,
  });

  // Initialize it
  arToolkitContext.init(() =>
    // Copy projection matrix to camera
    camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix()));

  // update artoolkit on every frame
  uiRenderer.on('render', () => {
    if (arToolkitSource.ready === false) {
      return;
    }

    arToolkitContext.update(arToolkitSource.domElement);
  });

  // Create a ArMarkerControls

  const markerRoot = new THREE.Group();
  scene.add(markerRoot);

  const artoolkitMarker = new THREEx.ArMarkerControls(arToolkitContext, markerRoot, {
    type: 'pattern',
    patternUrl: '/data/patt.hiro',
  });

  // Add an object in the scene

  get('/data/path.csv').then((data) => {
    const lines = data.split('\n');
    const dataLines = lines.slice(1);
    const scaler = scale => ({ x, y }) => ({
      x: x * scale,
      y: y * scale,
    });
    const translator = (dx, dy) => ({ x, y }) => ({
      x: x + dx,
      y: y + dy,
    });

    const points = dataLines
      .map(line => line.split(','))
      .map(([x, y]) => ({ x: parseFloat(x), y: parseFloat(y) }))
      .map(translator(-300, -300))
      .map(scaler(0.01));

    const lineMat = new THREE.LineBasicMaterial({ color: 0x0000ff });

    for (let i = 0; i < points.length - 1; i++) {
      const { x: x1, y: y1 } = points[i];
      const { x: x2, y: y2 } = points[i + 1];

      const lineGeom = new THREE.Geometry();

      lineGeom.vertices.push(
        new THREE.Vector3(x1, 0, y1),
        new THREE.Vector3(x2, 0, y2)
      );

      const line = new THREE.Line(lineGeom, lineMat);
      markerRoot.add(line);
    }

    console.log('Path loaded!');
  });

  // Render the whole thing on the page

  uiRenderer.on('render', () => renderer.render(scene, camera));

  // Run the rendering loop

  let lastTimeMsec = null;

  function animate(nowMsec) {
    // keep looping
    requestAnimationFrame(animate);
    // measure time
    lastTimeMsec = lastTimeMsec || nowMsec - (1000 / 60);
    const deltaMsec = Math.min(200, nowMsec - lastTimeMsec);
    lastTimeMsec = nowMsec;

    uiRenderer.emit('render', deltaMsec / 1000, nowMsec / 1000);
  }

  // Kick it all off
  requestAnimationFrame(animate);
}

interfaceUser();
