import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { pipeline, env } from "@xenova/transformers";

const OBJECTS = [
  {
    id: 0,
    name: "Seated Statue",
    file: "water_sitted.ply",
    position: [-5.6, 0, -1.2],
    description:
      "This seated/kneeling figure is best understood in the park's ceremonial landscape. Public descriptions of the memorial identify kneeling horn blowers along the central walkway and fountain pools; their music traditionally marks mourning for an important leader and guides visitors toward Nkrumah's tomb.",
    aliases: ["seated statue", "kneeling statue", "horn blower", "horn", "mourning", "fountain", "water"],
    sourceName: "Google Arts & Culture - Kwame Nkrumah Memorial Park",
    sourceUrl: "https://artsandculture.google.com/story/kwame-nkrumah-memorial-park-hacsa-foundation/QgXRpMwNhhcHsQ?hl=en",
  },
  {
    id: 1,
    name: "Piano",
    file: "piano.ply",
    position: [-3.7, 0, 1.35],
    description:
      "The public sources I found do not identify this exact piano by name. The safest label is that it belongs to the museum's personal-effects and furniture context: the memorial museum is documented as displaying Nkrumah's personal belongings, photographs, publications, furniture, and related historical material.",
    aliases: ["piano", "music", "instrument", "personal item", "museum item", "furniture"],
    sourceName: "Kwame Nkrumah Memorial Park - History & Museum",
    sourceUrl: "https://knmpp.com/",
  },
  {
    id: 2,
    name: "Bust / Head",
    file: "head.ply",
    position: [-1.55, 0, -1.25],
    description:
      "This object matches the documented head of the old Nkrumah statue. After the 1966 coup that overthrew Nkrumah's government, the statue was decapitated; the head disappeared and was returned in 2009 after being kept safe for 43 years.",
    aliases: ["bust", "head", "old statue head", "decapitated head", "returned head", "1966", "2009"],
    sourceName: "Google Arts & Culture - Head of Old Statue of Nkrumah",
    sourceUrl: "https://artsandculture.google.com/story/kwame-nkrumah-memorial-park-hacsa-foundation/QgXRpMwNhhcHsQ?hl=en",
  },
  {
    id: 3,
    name: "Chair",
    file: "chair.ply",
    position: [1.25, 0, 1.35],
    description:
      "The exact chair is not individually documented in the public sources I found. It should be presented as museum furniture or a personal-effect reconstruction: the memorial museum is described as displaying Nkrumah's personal belongings, furniture, books, photographs, and official historical material.",
    aliases: ["chair", "seat", "furniture", "personal item", "museum item"],
    sourceName: "Google Arts & Culture - Kwame Nkrumah Memorial Park",
    sourceUrl: "https://artsandculture.google.com/story/kwame-nkrumah-memorial-park-hacsa-foundation/QgXRpMwNhhcHsQ?hl=en",
  },
  {
    id: 4,
    name: "Standing Statue",
    file: "forward.ply",
    position: [3.45, 0, -1.15],
    description:
      "The central bronze statue represents Nkrumah in the spirit of the Convention People's Party slogan 'Forward ever, backward never.' It stands at the spot where Nkrumah declared Ghana's independence from British rule on March 6, 1957.",
    aliases: ["standing statue", "bronze statue", "forward", "independence", "march 6 1957", "nkrumah statue"],
    sourceName: "Google Arts & Culture - Statue of Dr. Kwame Nkrumah",
    sourceUrl: "https://artsandculture.google.com/story/kwame-nkrumah-memorial-park-hacsa-foundation/QgXRpMwNhhcHsQ?hl=en",
  },
  {
    id: 5,
    name: "Monument",
    file: "monument.ply",
    position: [0, 0, -3.2],
    description:
      "The memorial's main monument is the mausoleum for Dr. Kwame Nkrumah and his wife Fathia Nkrumah. Sources describe the mausoleum as symbolizing an upside-down sword, an Akan symbol of peace, and as part of a national site dedicated to Nkrumah's legacy and Pan-African vision.",
    aliases: ["monument", "mausoleum", "tomb", "memorial", "peace", "sword", "fathia"],
    sourceName: "Visit Ghana - Kwame Nkrumah Memorial Park",
    sourceUrl: "https://visitghana.com/kwame-nkrumah-memorial-park/",
  },
  {
    id: 6,
    name: "Headless Statue",
    file: "headless.ply",
    position: [5.55, 0, 1.05],
    description:
      "This is the damaged old statue of Nkrumah. It was created by Italian sculptor Nicola Cataudella, mounted in front of the Old Parliament House in Accra on March 5, 1958, and later toppled and decapitated after the 1966 coup.",
    aliases: ["headless", "headless statue", "old statue", "damaged statue", "decapitated statue", "1966 coup", "nicola cataudella"],
    sourceName: "Google Arts & Culture - Headless Old Statue of Nkrumah",
    sourceUrl: "https://artsandculture.google.com/story/kwame-nkrumah-memorial-park-hacsa-foundation/QgXRpMwNhhcHsQ?hl=en",
  },
];

const sceneEl = document.querySelector("#scene");
const labelsEl = document.querySelector("#labels");
const statusEl = document.querySelector("#status");
const queryInput = document.querySelector("#query");
const queryButton = document.querySelector("#queryButton");
const progressEl = document.querySelector("#modelProgress");
const infoPanel = document.querySelector("#infoPanel");
const infoTitle = document.querySelector("#infoTitle");
const infoDescription = document.querySelector("#infoDescription");
const infoFile = document.querySelector("#infoFile");
const infoScore = document.querySelector("#infoScore");
const infoSource = document.querySelector("#infoSource");
const closeInfo = document.querySelector("#closeInfo");
const overviewButton = document.querySelector("#overviewButton");
const focusButtons = [...document.querySelectorAll("[data-focus]")];

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
const spark = new SparkRenderer({ renderer });
const controls = new OrbitControls(camera, renderer.domElement);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const loadedObjects = [];
const labelScratch = new THREE.Vector3();
const cameraHome = new THREE.Vector3(0, 5.8, 13.2);
const targetHome = new THREE.Vector3(0, 0.85, -0.45);

let selectedObject = null;
let matchObject = null;
let cameraMove = null;
let classifierPromise = null;
let activeObjectForCapture = null;

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 4);

init();

async function init() {
  sceneEl.append(renderer.domElement);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x101313, 1);

  scene.background = new THREE.Color(0x101313);
  scene.fog = new THREE.Fog(0x101313, 10, 26);
  scene.add(spark);

  camera.position.copy(cameraHome);
  controls.target.copy(targetHome);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 2.6;
  controls.maxDistance = 18;

  buildMemorialScene();
  wireEvents();
  resize();

  statusEl.textContent = "Loading reconstructions...";
  await Promise.all(OBJECTS.map(loadObject));
  showOverview(false);
  statusEl.textContent = "Overview: tap an object to zoom in";
  queryButton.disabled = false;

  requestAnimationFrame(animate);
}

function buildMemorialScene() {
  scene.add(new THREE.HemisphereLight(0xfff7e3, 0x1b2422, 2.4));

  const key = new THREE.DirectionalLight(0xfff2cf, 2.1);
  key.position.set(-4, 7, 3);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xb7e7ff, 1.0);
  fill.position.set(5, 4, -5);
  scene.add(fill);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(8.6, 96),
    new THREE.MeshStandardMaterial({ color: 0x222322, roughness: 0.86, metalness: 0.08 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.03;
  scene.add(floor);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.15, 3.22, 96),
    new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.42 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.006;
  scene.add(ring);

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(15.8, 1.35),
    new THREE.MeshStandardMaterial({ color: 0x303231, roughness: 0.92 }),
  );
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.002;
  scene.add(path);
}

function wireEvents() {
  window.addEventListener("resize", resize);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  queryButton.addEventListener("click", runQuery);
  queryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runQuery();
  });
  overviewButton.addEventListener("click", () => showOverview(true));
  closeInfo.addEventListener("click", () => showOverview(true));
  focusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const object = loadedObjects.find((item) => item.config.id === Number(button.dataset.focus));
      if (object) selectObject(object);
    });
  });
}

function showOverview(animated) {
  selectedObject = null;
  infoPanel.classList.remove("open");
  for (const item of loadedObjects) {
    item.group.visible = true;
    item.label.classList.remove("selected");
  }
  focusButtons.forEach((button) => button.classList.remove("active"));
  statusEl.textContent = "Overview: tap an object to zoom in";
  if (animated) {
    moveCamera(cameraHome, targetHome, 900);
  } else {
    camera.position.copy(cameraHome);
    controls.target.copy(targetHome);
    controls.update();
  }
}

async function loadObject(config) {
  try {
    const response = await fetch(encodeURI(config.file));
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

    const bounds = readPlyBounds(await response.arrayBuffer());
    const transform = getSplatTransform(bounds);

    const group = new THREE.Group();
    group.position.set(...config.position);

    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.92, 0.18, 48),
      new THREE.MeshStandardMaterial({ color: 0x2b2f2f, roughness: 0.82 }),
    );
    plinth.position.y = 0.07;
    group.add(plinth);

    const splat = new SplatMesh({ url: encodeURI(config.file) });
    splat.rotation.x = -Math.PI / 2;
    splat.scale.setScalar(transform.scale);
    splat.position.copy(transform.offset);
    group.add(splat);

    const radius = Math.max(transform.radius, 0.9);
    const proxy = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.05, 24, 16),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    proxy.position.y = 0.2;
    proxy.userData.pickTarget = config.id;
    group.add(proxy);

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = config.name;
    labelsEl.append(label);

    const object = {
      config,
      group,
      splat,
      proxy,
      label,
      score: null,
      radius,
    };

    group.userData.object = object;
    scene.add(group);
    loadedObjects.push(object);
  } catch (error) {
    console.error(`Failed to load ${config.file}`, error);
    statusEl.textContent = `Could not load ${config.name}`;
  }
}

function getSplatTransform(bounds) {
  const min = rotateZUpToYUp(bounds.min);
  const max = rotateZUpToYUp(bounds.max);
  const rotatedMin = new THREE.Vector3(
    Math.min(min.x, max.x),
    Math.min(min.y, max.y),
    Math.min(min.z, max.z),
  );
  const rotatedMax = new THREE.Vector3(
    Math.max(min.x, max.x),
    Math.max(min.y, max.y),
    Math.max(min.z, max.z),
  );
  const center = new THREE.Vector3().addVectors(rotatedMin, rotatedMax).multiplyScalar(0.5);
  const size = new THREE.Vector3().subVectors(rotatedMax, rotatedMin);
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  const scale = 1.75 / maxDimension;
  const offset = new THREE.Vector3(-center.x * scale, 0.2 - rotatedMin.y * scale, -center.z * scale);
  return {
    offset,
    scale,
    radius: Math.max(size.x, size.y, size.z) * scale * 0.55,
  };
}

function rotateZUpToYUp(vector) {
  return new THREE.Vector3(vector.x, vector.z, -vector.y);
}

function selectObject(object) {
  selectedObject = object;
  infoPanel.classList.add("open");
  infoTitle.textContent = object.config.name;
  infoDescription.textContent = object.config.description;
  infoFile.textContent = object.config.file;
  infoScore.textContent = object.score === null ? "Not queried" : `${Math.round(object.score * 100)}%`;
  infoSource.href = object.config.sourceUrl;
  infoSource.textContent = object.config.sourceName;

  for (const item of loadedObjects) {
    item.group.visible = true;
    item.label.classList.toggle("selected", item === object);
  }

  focusButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.focus) === object.config.id);
  });

  const world = object.group.position.clone();
  const nextTarget = world.clone().add(new THREE.Vector3(0, 0.9, 0));
  const nextCamera = world.clone().add(new THREE.Vector3(0.15, 2.25, 3.1));
  moveCamera(nextCamera, nextTarget, 820);
  statusEl.textContent = `Selected: ${object.config.name}`;
}

function moveCamera(position, target, duration = 820) {
  cameraMove = {
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPosition: position,
    toTarget: target,
    started: performance.now(),
    duration,
  };
}

function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(loadedObjects.map((item) => item.proxy), false);
  const hit = hits[0]?.object.userData.pickTarget;
  const object = loadedObjects.find((item) => item.config.id === hit);
  if (object) selectObject(object);
}

async function runQuery() {
  const query = queryInput.value.trim();
  if (!query) {
    statusEl.textContent = "Enter a query first";
    return;
  }

  queryButton.disabled = true;
  progressEl.style.width = "0%";
  statusEl.textContent = "Loading SigLIP...";

  try {
    const results = await rankSiglipQuery(query);
    const best = results[0]?.object || selectedObject;
    if (!best || !isUsableSiglipResult(results)) {
      const fallback = rankTextQuery(query);
      const fallbackBest = fallback[0]?.object;
      if (fallbackBest && fallback[0].score > 0) {
        applyQueryResult(fallback, fallbackBest);
        progressEl.style.width = "100%";
        statusEl.textContent = `SigLIP was unsure; fallback match: ${fallbackBest.config.name}`;
        return;
      }
      progressEl.style.width = "100%";
      statusEl.textContent = `No strong match for "${query}"`;
      return;
    }

    applyQueryResult(results, best);
    progressEl.style.width = "100%";
    statusEl.textContent = `SigLIP match: ${best.config.name} (${Math.round(results[0].score * 100)}%)`;
  } catch (error) {
    console.error(error);
    statusEl.textContent = "SigLIP failed; using text fallback";
    const results = rankTextQuery(query);
    const best = results[0]?.object || selectedObject;
    if (best && results[0]?.score > 0) {
      applyQueryResult(results, best);
      progressEl.style.width = "100%";
      statusEl.textContent = `Fallback match: ${best.config.name} (${Math.round(results[0].score * 100)}%)`;
    }
  } finally {
    queryButton.disabled = false;
  }
}

async function rankSiglipQuery(query) {
  const classifier = await getClassifier();
  statusEl.textContent = `Rendering objects for "${query}"`;
  const labels = buildSiglipLabels(query);

  const results = [];
  for (let i = 0; i < loadedObjects.length; i += 1) {
    const object = loadedObjects[i];
    const image = captureObject(object);
    statusEl.textContent = `SigLIP scoring ${object.config.name}`;
    const output = await classifier(image, labels, {
      hypothesis_template: "a photo of a {}",
    });
    const queryResult = output.find((item) => normalizeText(item.label) === normalizeText(query));
    const score = queryResult?.score ?? 0;
    object.score = score;
    results.push({ object, score });
    progressEl.style.width = `${Math.round(((i + 1) / loadedObjects.length) * 100)}%`;
  }

  const sorted = results.sort((a, b) => b.score - a.score);
  console.table(
    sorted.map((result) => ({
      object: result.object.config.name,
      siglip_score: result.score,
    })),
  );
  return sorted;
}

function buildSiglipLabels(query) {
  return [
    query,
    "piano",
    "chair",
    "stool",
    "bust",
    "head",
    "monument",
    "mausoleum",
    "standing statue",
    "headless statue",
    "kneeling statue",
    "horn blower",
  ].filter((label, index, labels) => normalizeText(label) && labels.findIndex((item) => normalizeText(item) === normalizeText(label)) === index);
}

function isUsableSiglipResult(results) {
  const best = results[0]?.score ?? 0;
  const second = results[1]?.score ?? 0;
  return best >= 0.01 && best - second >= 0.001;
}

function applyQueryResult(results, best) {
  matchObject = best;
  for (const object of loadedObjects) {
    object.score = results.find((result) => result.object === object)?.score ?? 0;
    object.label.classList.toggle("match", object === best);
  }
  selectObject(best);
}

function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = pipeline(
      "zero-shot-image-classification",
      "Xenova/siglip-base-patch16-224",
      {
        progress_callback: (progress) => {
          if (typeof progress.progress === "number") {
            progressEl.style.width = `${Math.round(progress.progress)}%`;
          }
          if (progress.status) statusEl.textContent = `${progress.status} SigLIP`;
        },
      },
    );
  }
  return classifierPromise;
}

function captureObject(object) {
  const visibleStates = loadedObjects.map((item) => item.group.visible);
  const oldPosition = camera.position.clone();
  const oldTarget = controls.target.clone();
  const oldSelected = selectedObject;
  const oldActive = activeObjectForCapture;

  activeObjectForCapture = object;
  loadedObjects.forEach((item) => {
    item.group.visible = item === object;
  });
  infoPanel.classList.remove("open");

  const world = object.group.position.clone();
  camera.position.copy(world).add(new THREE.Vector3(0.05, 1.4, 3.0));
  controls.target.copy(world).add(new THREE.Vector3(0, 0.9, 0));
  camera.lookAt(controls.target);
  controls.update();
  renderer.render(scene, camera);

  const canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 224;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#101313";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);

  loadedObjects.forEach((item, index) => {
    item.group.visible = visibleStates[index];
  });
  selectedObject = oldSelected;
  activeObjectForCapture = oldActive;
  camera.position.copy(oldPosition);
  controls.target.copy(oldTarget);
  controls.update();

  return canvas.toDataURL("image/png");
}

function rankTextQuery(query) {
  const queryTokens = tokenize(query);
  return loadedObjects
    .map((object) => {
      const searchable = [
        object.config.name,
        object.config.file.replace(".ply", ""),
        object.config.description,
        ...(object.config.aliases || []),
      ].join(" ");
      const text = normalizeText(searchable);
      const terms = [...new Set([...tokenize(searchable), ...(object.config.aliases || []).flatMap(tokenize)])];
      let score = 0;

      if (normalizeText(object.config.name) === normalizeText(query)) score += 1.2;
      if ((object.config.aliases || []).some((alias) => normalizeText(alias) === normalizeText(query))) score += 1.1;
      if (text.includes(normalizeText(query))) score += 0.7;

      for (const token of queryTokens) {
        if (token.length < 2) continue;
        if (terms.includes(token)) {
          score += 0.45;
        } else if (terms.some((term) => isCloseToken(token, term))) {
          score += 0.28;
        }
      }

      return { object, score: Math.min(score, 1) };
    })
    .sort((a, b) => b.score - a.score);
}

function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function isCloseToken(queryToken, term) {
  if (term.length < 3) return false;
  if (term.startsWith(queryToken) || queryToken.startsWith(term)) return true;
  return levenshtein(queryToken, term) <= (queryToken.length <= 5 ? 1 : 2);
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function resize() {
  const width = Math.max(1, sceneEl.clientWidth);
  const height = Math.max(1, sceneEl.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  updateCameraMove();
  controls.update();
  renderer.render(scene, camera);
  updateLabels();
  requestAnimationFrame(animate);
}

function updateCameraMove() {
  if (!cameraMove) return;
  const elapsed = performance.now() - cameraMove.started;
  const t = Math.min(elapsed / cameraMove.duration, 1);
  const eased = 1 - (1 - t) ** 3;
  camera.position.lerpVectors(cameraMove.fromPosition, cameraMove.toPosition, eased);
  controls.target.lerpVectors(cameraMove.fromTarget, cameraMove.toTarget, eased);
  if (t === 1) cameraMove = null;
}

function updateLabels() {
  const width = sceneEl.clientWidth;
  const height = sceneEl.clientHeight;

  for (const object of loadedObjects) {
    labelScratch.copy(object.group.position).y += 2.25;
    labelScratch.project(camera);
    const visible = labelScratch.z < 1;
    object.label.style.display = visible ? "block" : "none";
    object.label.style.left = `${(labelScratch.x * 0.5 + 0.5) * width}px`;
    object.label.style.top = `${(-labelScratch.y * 0.5 + 0.5) * height}px`;
    object.label.classList.toggle("match", object === matchObject);
  }
}

function readPlyBounds(buffer) {
  const bytes = new Uint8Array(buffer);
  const headerEnd = findHeaderEnd(bytes);
  const header = new TextDecoder().decode(bytes.slice(0, headerEnd));
  const lines = header.split(/\r?\n/);

  let vertexCount = 0;
  const properties = [];
  let readingVertex = false;

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "element") {
      readingVertex = parts[1] === "vertex";
      if (readingVertex) vertexCount = Number(parts[2]);
    } else if (readingVertex && parts[0] === "property") {
      properties.push({ type: parts[1], name: parts[2] });
    }
  }

  if (!vertexCount || !properties.length) {
    throw new Error("PLY vertex header is missing or unsupported.");
  }

  const stride = properties.reduce((sum, property) => sum + byteSize(property.type), 0);
  const dataView = new DataView(buffer, headerEnd);
  const indices = {
    x: properties.findIndex((property) => property.name === "x"),
    y: properties.findIndex((property) => property.name === "y"),
    z: properties.findIndex((property) => property.name === "z"),
  };
  for (const [name, index] of Object.entries(indices)) {
    if (index === -1) throw new Error(`PLY is missing required property: ${name}`);
  }
  const offsets = propertyOffsets(properties);
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  for (let i = 0; i < vertexCount; i += 1) {
    const rowOffset = i * stride;
    const x = readProperty(dataView, rowOffset + offsets[indices.x], properties[indices.x].type);
    const y = readProperty(dataView, rowOffset + offsets[indices.y], properties[indices.y].type);
    const z = readProperty(dataView, rowOffset + offsets[indices.z], properties[indices.z].type);
    min.min(new THREE.Vector3(x, y, z));
    max.max(new THREE.Vector3(x, y, z));
  }

  return { min, max };
}

function findHeaderEnd(bytes) {
  const encoder = new TextEncoder();
  const markers = [encoder.encode("end_header\n"), encoder.encode("end_header\r\n")];
  for (const marker of markers) {
    const offset = findBytes(bytes, marker);
    if (offset !== -1) return offset + marker.length;
  }
  throw new Error("Could not find PLY header end.");
}

function findBytes(bytes, marker) {
  for (let i = 0; i <= bytes.length - marker.length; i += 1) {
    let match = true;
    for (let j = 0; j < marker.length; j += 1) {
      if (bytes[i + j] !== marker[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

function propertyOffsets(properties) {
  let offset = 0;
  return properties.map((property) => {
    const current = offset;
    offset += byteSize(property.type);
    return current;
  });
}

function byteSize(type) {
  const sizes = {
    char: 1,
    uchar: 1,
    int8: 1,
    uint8: 1,
    short: 2,
    ushort: 2,
    int16: 2,
    uint16: 2,
    int: 4,
    uint: 4,
    int32: 4,
    uint32: 4,
    float: 4,
    float32: 4,
    double: 8,
    float64: 8,
  };
  if (!sizes[type]) throw new Error(`Unsupported PLY property type: ${type}`);
  return sizes[type];
}

function readProperty(dataView, offset, type) {
  switch (type) {
    case "char":
    case "int8":
      return dataView.getInt8(offset);
    case "uchar":
    case "uint8":
      return dataView.getUint8(offset);
    case "short":
    case "int16":
      return dataView.getInt16(offset, true);
    case "ushort":
    case "uint16":
      return dataView.getUint16(offset, true);
    case "int":
    case "int32":
      return dataView.getInt32(offset, true);
    case "uint":
    case "uint32":
      return dataView.getUint32(offset, true);
    case "double":
    case "float64":
      return dataView.getFloat64(offset, true);
    default:
      return dataView.getFloat32(offset, true);
  }
}
