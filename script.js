let currentUserId = localStorage.getItem("userId");

function log(message) {
  console.log(message);
  const debug = document.getElementById("debug");
  if (debug) debug.textContent = message;
}

function showSection(sectionId) {
  const auth = document.getElementById("auth");
  const feed = document.getElementById("feed");
  const profile = document.getElementById("profile");
  const logoutBtn = document.getElementById("logoutBtn");
  if (auth) auth.style.display = sectionId === "auth" ? "block" : "none";
  if (feed) feed.style.display = sectionId === "feed" ? "block" : "none";
  if (profile) profile.style.display = sectionId === "profile" ? "block" : "none";
  if (logoutBtn) logoutBtn.style.display = sectionId !== "auth" ? "inline" : "none";
}

function checkUser() {
  if (currentUserId) {
    log("User loaded: " + currentUserId);
    showSection(window.location.pathname.endsWith("profile.html") ? "profile" : "feed");
    updateFeed(); // Force feed update on load
    updateProfile(); // Force profile update
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
        } else {
          log("Wrong password");
          alert("Wrong password!");
        }
      } else {
        setDoc(doc(db, "users", userId), { password: password })
          .then(() => {
            currentUserId = userId;
            localStorage.setItem("userId", userId);
            log("Signed up as " + userId);
            showSection(window.location.pathname.endsWith("profile.html") ? "profile" : "feed");
            updateFeed();
            updateProfile();
          })
          .catch((error) => log("Signup error: " + error.message));
      }
    })
    .catch((error) => log("Check user error: " + error.message));
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
function addPost() {
  if (!currentUserId) {
    log("No user, showing auth...");
    showSection("auth");
    return;
  }
  const postInput = document.getElementById("postInput").value;
  const mediaInput = document.getElementById("mediaInput").files[0];
  if (!postInput && !mediaInput) {
    log("No post content");
    alert("Please add text or media");
    return;
  }
  const postData = { text: postInput, userId: currentUserId, timestamp: new Date(), likes: 0, comments: [] };
  if (mediaInput) {
    uploadToCloudinary(mediaInput, (url) => {
      postData.media = url;
      addDoc(collection(db, "posts"), postData)
        .then(() => log("Post added with media"))
        .catch((error) => log("Post error: " + error.message));
    });
  } else {
    addDoc(collection(db, "posts"), postData)
      .then(() => log("Post added"))
      .catch((error) => log("Post error: " + error.message));
  }
  document.getElementById("postInput").value = "";
  document.getElementById("mediaInput").value = "";
}

function updateFeed() {
  const postList = document.getElementById("postList");
  if (!postList) return;
  onSnapshot(query(collection(db, "posts"), orderBy("timestamp", "desc")), (snapshot) => {
    postList.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="post-content">
          ${data.text || ""}
          ${data.media ? (data.media.includes("video") ? `<video src="${data.media}" controls></video>` : `<img src="${data.media}">`) : ""}
        </div>
        <div class="post-actions">
          <button onclick="likePost('${doc.id}')">Like (${data.likes})</button>
          <button onclick="repost('${doc.id}')">Repost</button>
          <input id="comment-${doc.id}" type="text" placeholder="Add a comment">
          <button onclick="addComment('${doc.id}')">Comment</button>
        </div>
        <div class="comments">${data.comments ? data.comments.map(c => `<p>${c}</p>`).join("") : ""}</div>
      `;
      postList.appendChild(li);
    });
    log("Feed updated with " + snapshot.size + " posts");
  }, (error) => log("Feed error: " + error.message));
}

function likePost(postId) {
  updateDoc(doc(db, "posts", postId), { likes: firebase.firestore.FieldValue.increment(1) })
    .then(() => log("Post liked"))
    .catch((error) => log("Like error: " + error.message));
}

function repost(postId) {
  getDoc(doc(db, "posts", postId)).then((docSnap) => {
    if (docSnap.exists()) {
      const original = docSnap.data();
      const repostData = {
        text: original.text,
        media: original.media,
        userId: currentUserId,
        timestamp: new Date(),
        likes: 0,
        comments: [],
        repostFrom: postId
      };
      addDoc(collection(db, "posts"), repostData)
        .then(() => log("Reposted"))
        .catch((error) => log("Repost error: " + error.message));
    }
  });
}

function addComment(postId) {
  const commentInput = document.getElementById(`comment-${postId}`).value;
  if (!commentInput) {
    log("No comment entered");
    return;
  }
  updateDoc(doc(db, "posts", postId), {
    comments: firebase.firestore.FieldValue.arrayUnion(commentInput)
  })
    .then(() => {
      log("Comment added");
      document.getElementById(`comment-${postId}`).value = "";
    })
    .catch((error) => log("Comment error: " + error.message));
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
    }, (error) => log("Bio load error: " + error.message));
  }
  if (mediaGrid) {
    onSnapshot(query(collection(db, "profiles", currentUserId || "dummy", "media"), orderBy("timestamp", "desc")), (snapshot) => {
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
    }, (error) => log("Media error: " + error.message));
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
      .then(() => log("Media uploaded"))
      .catch((error) => log("Upload error: " + error.message));
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
    .then(() => log("Bio updated"))
    .catch((error) => log("Bio error: " + error.message));
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
    })
    .catch(error => log("Upload error: " + error.message));
                       }
