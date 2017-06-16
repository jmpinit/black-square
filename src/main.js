/* global THREEx */
const THREE = require('three');
const EventEmitter = require('events').EventEmitter;
const get = require('./get');

let pathObject;
let pathMat;

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

  const vertShaderPromise = get('/shaders/path.vert');
  const fragShaderPromise = get('/shaders/path.frag');

  Promise.all([get('/data/path.csv'), vertShaderPromise, fragShaderPromise])
    .then(([data, vertShader, fragShader]) => {
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

      // const lineMat = new THREE.LineBasicMaterial({ color: 0x0000ff });

      pathMat = new THREE.ShaderMaterial({
        vertexShader: vertShader,
        fragmentShader: fragShader,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        transparent: true,
      });

      const lineGeom = new THREE.Geometry();

      points.forEach(({ x, y }) =>
        lineGeom.vertices.push(new THREE.Vector3(x, 0, y)));

      const bufferGeometry = new THREE.BufferGeometry();

      const vertices = lineGeom.vertices;
      const position = new THREE.Float32BufferAttribute(vertices.length * 3, 3).copyVector3sArray(vertices);
      bufferGeometry.addAttribute('position', position);

      const displacement = new THREE.Float32BufferAttribute(vertices.length * 3, 3);
      bufferGeometry.addAttribute('displacement', displacement);

      pathObject = new THREE.Line(bufferGeometry, pathMat);
      markerRoot.add(pathObject);

      console.log('Path loaded!');
    });

  // Render the whole thing on the page

  uiRenderer.on('render', () => renderer.render(scene, camera));

  // Run the rendering loop

  let lastTimeMsec = null;
  let time = 0;

  function animate(nowMsec) {
    if (pathObject) {
      // pathMat.uniforms.time.value = time;

      const array = pathObject.geometry.attributes.displacement.array;
      for (let i = 0; i < array.length; i += 3) {
        // array[i] = 0.1 * (0.5 - Math.random());
        array[i + 1] = 0.3 * (1 + Math.sin(Date.now() / 1000 + 0.2 * 2 * Math.PI * i / array.length));
        // array[i + 2] = 0.1 * (0.5 - Math.random());
      }

      pathObject.geometry.attributes.displacement.needsUpdate = true;
    }

    // keep looping
    requestAnimationFrame(animate);
    // measure time
    lastTimeMsec = lastTimeMsec || nowMsec - (1000 / 60);
    const deltaMsec = Math.min(200, nowMsec - lastTimeMsec);
    lastTimeMsec = nowMsec;
    time += lastTimeMsec;

    uiRenderer.emit('render', deltaMsec / 1000, nowMsec / 1000);
  }

  // Kick it all off
  requestAnimationFrame(animate);
}

interfaceUser();
