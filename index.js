function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
        request.oncomplete = request.onsuccess = () => resolve(request.result);
        request.onabort = request.onerror = () => reject(request.error);
    });
}

function createStore(dbName, storeName) {
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    const dbp = promisifyRequest(request);
    return (txMode, callback) => dbp.then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}

let defaultGetStoreFunc;
function defaultGetStore() {
    if (!defaultGetStoreFunc) defaultGetStoreFunc = createStore('files-store', 'files');
    return defaultGetStoreFunc;
}


function eachCursor(customStore, callback) {
    return customStore('readonly', (store) => {
        store.openCursor().onsuccess = function() {
            if (!this.result)
                return;
            callback(this.result);
            this.result.continue();
        };
        return promisifyRequest(store.transaction);
    });
}

/**
 * Set a value with a key.
 *
 * @param key
 * @param value
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function set(key, value, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.put(value, key);
        return promisifyRequest(store.transaction);
    });
}
/**
 * Get all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function values(customStore = defaultGetStore()) {
    const items = [];
    return eachCursor(customStore, (cursor) => items.push(cursor.value)).then(() => items);
}


const audio = document.getElementById('audio');
const fileList = document.getElementById('fileList');
const playPauseButton = document.getElementById('playPause');
let fileHandles = []

document.addEventListener('DOMContentLoaded', loadFileList);

async function addFiles() {
    const newFilesHandles = await window.showOpenFilePicker({
        startIn: "music",
        excludeAcceptAllOption: true,
        multiple: true,
        types: [{ description: 'Audio Files', accept: { 'audio/*': ['.mp3', '.wav'] } }]
    });


    for (const fileHandle of newFilesHandles) {
        fileHandles.push(fileHandle);
        await set(fileHandle.name, fileHandle);

        addToFileList(fileHandle);
    }
}

async function verifyPermission(fileHandle) {
    const options = { mode: 'read' };

    if ((await fileHandle.queryPermission(options)) === 'granted') return true;

    if ((await fileHandle.requestPermission(options)) === 'granted') return true;

    return false;
}

async function loadFileList() {
    fileHandles = await values()
    for (const handle of fileHandles) addToFileList(handle);
}

function addToFileList(handle) {
    const li = document.createElement('li');
    li.textContent = `${handle.name}`;

    li.onclick = async () => {
        if (await verifyPermission(handle)) playFile(handle);
        else console.error("file access denied");
    }

    fileList.appendChild(li);
}

async function playFile(handle) {
    if (!handle) return;
    const fileData = await handle.getFile();
    const dataURL = URL.createObjectURL(fileData);

    audio.src = dataURL;
    audio.load();
    audio.play();
}

function togglePlay() {
    if (audio.paused) {
        audio.play();
        playPauseButton.innerText = 'Pause';
    } else {
        audio.pause();
        playPauseButton.innerText = 'Play';
    }
}

function changeVolume(value) {
    audio.volume = value;
}


document.addEventListener('keyup', event => {
    if (event.code === 'Space') togglePlay();
})
