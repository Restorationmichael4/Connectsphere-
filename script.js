let currentUserId = localStorage.getItem("userId");
let currentChatUser = null;

function log(message) {
  console.log(message);
  const debug = document.getElementById("debug");
  if (debug) debug.textContent = message;
}

function showSection(sectionId) {
  const sections = ["auth", "feed", "profile", "clips", "messages"];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === sectionId ? "block" : "none";
  });
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.style.display = sectionId !== "auth" ? "inline" : "none";
  if (sectionId === "messages") updateMessages();
  if (sectionId === "clips") updateClips();
  if (sectionId === "feed") updateFeed();
}

function checkUser() {
  if (currentUserId) {
    log("User loaded: " + currentUserId);
    showSection(window.location.pathname.endsWith("profile.html") ? "profile" : "feed");
    updateFeed();
    updateProfile();
    updateClips();
    updateMessages();
  } else {
    log("No user, showing auth...");
    showSection("auth");
  }
}
window.addEventListener("load", checkUser);

function signUpOrLogin() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  if (!username || !password) {
    log("Username or password missing");
    alert("Please enter both username and password");
    return;
  }
  const userId = username.toLowerCase();
  getDoc(doc(db, "users", userId))
    .then((docSnap) => {
      if (docSnap.exists()) {
        if (docSnap.data().password === password) {
          currentUserId = userId;
          localStorage.setItem("userId", userId);
          log("Logged in as " + userId);
          showSection(window.location.pathname.endsWith("profile.html") ? "profile" : "feed");
          updateFeed();
          updateProfile();
          updateClips();
          updateMessages();
        } else {
          log("Wrong password");
          alert("Wrong password!");
        }
      } else {
        setDoc(doc(db, "users", userId), { password: password, profilePic: "default.jpg" })
          .then(() => {
            currentUserId = userId;
            localStorage.setItem("userId", userId);
            log("Signed up as " + userId);
            showSection(window.location.pathname.endsWith("profile.html") ? "profile" : "feed");
            updateFeed();
            updateProfile();
            updateClips();
            updateMessages();
          });
      }
    });
}

function logout() {
  currentUserId = null;
  localStorage.removeItem("userId");
  log("Logged out");
  showSection("auth");
}

// --- Theme Toggle ---
function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
}
if (localStorage.getItem("theme") === "dark") toggleTheme();

// --- Feed ---
function addPost(isClip = false) {
  if (!currentUserId) {
    log("No user, showing auth...");
    showSection("auth");
    return;
  }
  const postInput = document.getElementById(isClip ? "clipInput" : "postInput").value;
  const mediaInput = document.getElementById(isClip ? "clipMediaInput" : "mediaInput").files[0];
  if (!postInput && !mediaInput) {
    log("No post content");
    alert("Please add text or media");
    return;
  }
  const postData = { text: postInput, userId: currentUserId, timestamp: new Date(), likes: 0, comments: [], isClip };
  if (mediaInput) {
    if (isClip) {
      const start = document.getElementById("clipTrimStart").value / 100;
      const end = document.getElementById("clipTrimEnd").value / 100;
      uploadToCloudinary(mediaInput, (url) => {
        postData.media = url;
        postData.trim = { start, end };
        addDoc(collection(db, "posts"), postData)
          .then(() => log("Clip added"));
      });
    } else {
      uploadToCloudinary(mediaInput, (url) => {
        postData.media = url;
        addDoc(collection(db, "posts"), postData)
          .then(() => log("Post added with media"));
      });
    }
  } else {
    addDoc(collection(db, "posts"), postData)
      .then(() => log(isClip ? "Clip added" : "Post added"));
  }
  document.getElementById(isClip ? "clipInput" : "postInput").value = "";
  document.getElementById(isClip ? "clipMediaInput" : "mediaInput").value = "";
  document.getElementById("clipPreview").style.display = "none";
}

function updateFeed() {
  const postList = document.getElementById("postList");
  if (!postList) return;
  onSnapshot(query(collection(db, "posts"), where("isClip", "==", false), orderBy("timestamp", "desc")), (snapshot) => {
    postList.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      getDoc(doc(db, "users", data.userId)).then(userSnap => {
        const user = userSnap.data();
        const li = document.createElement("li");
        li.innerHTML = `
          <div class="post-header">
            <img src="${user.profilePic}" alt="Profile" class="profile-pic">
            <span>${data.userId}</span>
          </div>
          <div class="post-content">
            ${data.text || ""}
            ${data.media ? (data.media.includes("video") ? `<video src="${data.media}" controls></video>` : `<img src="${data.media}">`) : ""}
          </div>
          <div class="post-actions">
            <button onclick="likePost('${doc.id}')">Like (${data.likes})</button>
            <button onclick="repost('${doc.id}')">Repost</button>
            <input id="comment-${doc.id}" type="text" placeholder="Add a comment">
            <button onclick="addComment('${doc.id}')">Comment</button>
            <button onclick="sendMessage('${data.userId}')">DM</button>
          </div>
          <div class="comments">${data.comments.map(c => `<p>${c}</p>`).join("")}</div>
        `;
        postList.appendChild(li);
      });
    });
    log("Feed updated with " + snapshot.size + " posts");
  });
}

function updateClips() {
  const clipList = document.getElementById("clipList");
  if (!clipList) return;
  onSnapshot(query(collection(db, "posts"), where("isClip", "==", true), orderBy("timestamp", "desc")), (snapshot) => {
    clipList.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      getDoc(doc(db, "users", data.userId)).then(userSnap => {
        const user = userSnap.data();
        const li = document.createElement("li");
        li.innerHTML = `
          <div class="post-header">
            <img src="${user.profilePic}" alt="Profile" class="profile-pic">
            <span>${data.userId}</span>
          </div>
          <div class="post-content">
            ${data.media ? (data.media.includes("video") ? `<video src="${data.media}" controls autoplay muted ${data.trim ? `data-trim-start="${data.trim.start}" data-trim-end="${data.trim.end}"` : ""}></video>` : `<img src="${data.media}">`) : data.text || ""}
          </div>
          <div class="post-actions">
            <button onclick="likePost('${doc.id}')">Like (${data.likes})</button>
            <button onclick="repost('${doc.id}')">Repost</button>
            <input id="comment-${doc.id}" type="text" placeholder="Add a comment">
            <button onclick="addComment('${doc.id}')">Comment</button>
            <button onclick="sendMessage('${data.userId}')">DM</button>
          </div>
          <div class="comments">${data.comments.map(c => `<p>${c}</p>`).join("")}</div>
        `;
        clipList.appendChild(li);
        if (data.media && data.media.includes("video") && data.trim) {
          const video = li.querySelector("video");
          video.addEventListener("loadedmetadata", () => {
            const duration = video.duration;
            video.currentTime = data.trim.start * duration;
            video.addEventListener("timeupdate", () => {
              if (video.currentTime >= data.trim.end * duration) video.currentTime = data.trim.start * duration;
            });
          });
        }
    });
    });
    log("Clips updated with " + snapshot.size + " clips");
  });
}

function likePost(postId) {
  const postRef = doc(db, "posts", postId);
  updateDoc(postRef, { likes: firebase.firestore.FieldValue.increment(1) })
    .then(() => log("Post liked"));
}

function repost(postId) {
  getDoc(doc(db, "posts", postId)).then((docSnap) => {
    if (docSnap.exists()) {
      const original = docSnap.data();
      const repostData = { ...original, userId: currentUserId, timestamp: new Date(), likes: 0, comments: [], repostFrom: postId };
      addDoc(collection(db, "posts"), repostData)
        .then(() => log("Reposted"));
    }
  });
}

function addComment(postId) {
  const commentInput = document.getElementById(`comment-${postId}`).value;
  if (!commentInput) {
    log("No comment entered");
    return;
  }
  const postRef = doc(db, "posts", postId);
  updateDoc(postRef, { comments: firebase.firestore.FieldValue.arrayUnion(commentInput) })
    .then(() => {
      log("Comment added");
      document.getElementById(`comment-${postId}`).value = "";
    });
}

// --- Profile ---
function updateProfile() {
  const bioDisplay = document.getElementById("bioDisplay");
  const mediaGrid = document.getElementById("mediaGrid");
  if (bioDisplay) {
    onSnapshot(doc(db, "profiles", currentUserId || "dummy"), (docSnap) => {
      if (docSnap.exists()) {
        bioDisplay.textContent = docSnap.data().bio || "No bio yet";
        log("Bio loaded");
      }
    });
  }
  if (mediaGrid) {
    onSnapshot(query(collection(db, "profiles", currentUserId, "media"), orderBy("timestamp", "desc")), (snapshot) => {
      mediaGrid.innerHTML = "";
      snapshot.forEach((doc) => {
        const data = doc.data();
        const div = document.createElement("div");
        const el = data.url.includes("video") ? document.createElement("video") : document.createElement("img");
        el.src = data.url;
        if (el.tagName === "VIDEO") el.controls = true;
        div.appendChild(el);
        mediaGrid.appendChild(div);
      });
      log("Media grid updated");
    });
  }
}

function uploadMedia() {
  if (!currentUserId) {
    log("No user, showing auth...");
    showSection("auth");
    return;
  }
  const mediaInput = document.getElementById("profileMediaInput").files[0];
  if (!mediaInput) {
    log("No media selected");
    alert("Please select a file");
    return;
  }
  uploadToCloudinary(mediaInput, (url) => {
    addDoc(collection(db, "profiles", currentUserId, "media"), { url, timestamp: new Date() })
      .then(() => log("Media uploaded"));
  });
}

function updateBio() {
  if (!currentUserId) {
    log("No user, showing auth...");
    showSection("auth");
    return;
  }
  const bio = document.getElementById("bioInput").value.slice(0, 150);
  if (!bio) {
    log("No bio entered");
    alert("Please enter a bio");
    return;
  }
  setDoc(doc(db, "profiles", currentUserId), { bio }, { merge: true })
    .then(() => log("Bio updated"));
}

// --- Messages ---
function sendMessage(toUserId) {
  if (!currentUserId) return;
  currentChatUser = toUserId;
  showSection("messages");
}

function sendCurrentMessage() {
  if (!currentUserId || !currentChatUser) return;
  const message = document.getElementById("messageInput").value.trim();
  if (!message) return;
  addDoc(collection(db, "messages"), {
    from: currentUserId,
    to: currentChatUser,
    text: message,
    timestamp: new Date()
  }).then(() => {
    log("Message sent");
    document.getElementById("messageInput").value = "";
  });
}

function updateMessages() {
  const messageList = document.getElementById("messageList");
  if (!messageList || !currentChatUser) return;
  onSnapshot(query(collection(db, "messages"), where("from", "in", [currentUserId, currentChatUser]), where("to", "in", [currentUserId, currentChatUser]), orderBy("timestamp", "asc")), (snapshot) => {
    messageList.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const div = document.createElement("div");
      div.className = `chat-message ${data.from === currentUserId ? "sent" : "received"}`;
      div.innerHTML = `
        <div class="bubble">${data.text}</div>
        <div class="timestamp">${new Date(data.timestamp.toMillis()).toLocaleTimeString()}</div>
      `;
      messageList.appendChild(div);
    });
    messageList.scrollTop = messageList.scrollHeight;
    log("Messages updated with " + snapshot.size + " messages");
  });
}

// --- Search ---
function searchUsers() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  if (!query) return;
  onSnapshot(query(collection(db, "users")), (snapshot) => {
    const searchResults = document.getElementById("searchResults");
    searchResults.innerHTML = "";
    snapshot.forEach((doc) => {
      const userId = doc.id;
      if (userId.includes(query) && userId !== currentUserId) {
        const li = document.createElement("li");
        li.innerHTML = `<span>${userId}</span> <button onclick="sendMessage('${userId}')">DM</button>`;
        searchResults.appendChild(li);
      }
    });
    log("Search found " + snapshot.size + " users");
  });
}

// --- Clip Editing ---
function previewClip() {
  const file = document.getElementById("clipMediaInput").files[0];
  if (!file) return;
  const video = document.getElementById("clipVideo");
  const preview = document.getElementById("clipPreview");
  video.src = URL.createObjectURL(file);
  preview.style.display = "block";
  video.onloadedmetadata = () => {
    document.getElementById("clipTrimEnd").max = video.duration;
    document.getElementById("clipTrimEnd").value = video.duration;
  };
}

// --- Cloudinary Upload ---
function uploadToCloudinary(file, callback) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "Connectsphere");
  fetch("https://api.cloudinary.com/v1_1/dwhdglhha/auto/upload", {
    method: "POST",
    body: formData
  })
    .then(response => response.json())
    .then(data => {
      log("Upload success: " + data.secure_url);
      callback(data.secure_url);
    });
}
