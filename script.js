let currentUser = null;

// --- Auth ---
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const status = document.getElementById("userStatus");
  if (status) {
    status.textContent = user ? `Logged in as ${user.email}` : "Not logged in";
    if (!user && window.location.pathname !== "/auth.html") window.location.href = "auth.html";
  }
});

function signUp() {
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      setDoc(doc(db, "profiles", userCredential.user.uid), { bio: "", private: false });
      window.location.href = "index.html";
    })
    .catch((error) => alert(error.message));
}

function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  signInWithEmailAndPassword(auth, email, password)
    .then(() => window.location.href = "index.html")
    .catch((error) => alert(error.message));
}

function signOut() {
  signOut(auth).then(() => window.location.href = "auth.html");
}

// --- Theme Toggle ---
function toggleTheme() {
  document.body.classList.toggle("dark");
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
}
if (localStorage.getItem("theme") === "dark") toggleTheme();

// --- Feed ---
function addPost() {
  if (!currentUser) return alert("Please log in!");
  const postInput = document.getElementById("postInput").value;
  const mediaInput = document.getElementById("mediaInput").files[0];
  if (postInput || mediaInput) {
    const postData = { text: postInput, userId: currentUser.uid, timestamp: new Date(), likes: 0, reactions: {}, comments: [] };
    if (mediaInput) {
      uploadToCloudinary(mediaInput, (url) => {
        postData.media = url;
        addDoc(collection(db, "posts"), postData);
      });
    } else {
      addDoc(collection(db, "posts"), postData);
    }
    document.getElementById("postInput").value = "";
    document.getElementById("mediaInput").value = "";
  }
}

onSnapshot(query(collection(db, "posts"), orderBy("timestamp", "desc")), (snapshot) => {
  const postList = document.getElementById("postList");
  if (postList) {
    postList.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const li = document.createElement("li");
      li.innerHTML = `
        ${data.text || ""} 
        ${data.media ? (data.media.includes("video") ? `<video src="${data.media}" controls></video>` : `<img src="${data.media}">`) : ""} 
        <button onclick="likePost('${doc.id}')">Like (${data.likes})</button>
        <span class="reaction" onclick="reactToPost('${doc.id}', '😂')">😂 ${data.reactions?.['😂'] || 0}</span>
        <span class="reaction" onclick="reactToPost('${doc.id}', '👍')">👍 ${data.reactions?.['👍'] || 0}</span>
        <input id="comment-${doc.id}" placeholder="Add a comment">
        <button onclick="addComment('${doc.id}')">Comment</button>
        <ul>${data.comments?.map(c => `<li>${c}</li>`).join("") || ""}</ul>
      `;
      postList.appendChild(li);
    });
    showNotification("New post added!");
  }
  updateTrending();
  updateExplore();
});

function likePost(postId) {
  updateDoc(doc(db, "posts", postId), { likes: firebase.firestore.FieldValue.increment(1) });
}

function reactToPost(postId, emoji) {
  updateDoc(doc(db, "posts", postId), { [`reactions.${emoji}`]: firebase.firestore.FieldValue.increment(1) });
}

function addComment(postId) {
  const comment = document.getElementById(`comment-${postId}`).value;
  if (comment) {
    updateDoc(doc(db, "posts", postId), { comments: firebase.firestore.FieldValue.arrayUnion(comment) });
    document.getElementById(`comment-${postId}`).value = "";
  }
}

// --- Trending ---
function updateTrending() {
  const trendingList = document.getElementById("trendingList");
  if (trendingList) {
    getDocs(collection(db, "posts")).then((snapshot) => {
      const tags = {};
      snapshot.forEach((doc) => {
        const text = doc.data().text || "";
        text.split(" ").forEach(word => {
          if (word.startsWith("#")) tags[word] = (tags[word] || 0) + 1;
        });
      });
      trendingList.innerHTML = "";
      Object.keys(tags).sort((a, b) => tags[b] - tags[a]).slice(0, 5).forEach(tag => {
        const li = document.createElement("li");
        li.textContent = `${tag} (${tags[tag]})`;
        trendingList.appendChild(li);
      });
    });
  }
}

// --- Groups ---
function addGroupMessage() {
  if (!currentUser) return alert("Please log in!");
  const groupInput = document.getElementById("groupInput").value;
  if (groupInput) {
    addDoc(collection(db, "groupChat"), { text: groupInput, userId: currentUser.uid, timestamp: new Date() });
    document.getElementById("groupInput").value = "";
  }
}

onSnapshot(query(collection(db, "groupChat"), orderBy("timestamp", "desc")), (snapshot) => {
  const groupList = document.getElementById("groupList");
  if (groupList) {
    groupList.innerHTML = "";
    snapshot.forEach((doc) => {
      const li = document.createElement("li");
      li.textContent = doc.data().text;
      groupList.appendChild(li);
    });
  }
});

// --- Profile Media & Bio ---
function uploadMedia() {
  if (!currentUser) return alert("Please log in!");
  const mediaInput = document.getElementById("profileMediaInput").files[0];
  if (mediaInput) {
    uploadToCloudinary(mediaInput, (url) => {
      addDoc(collection(db, "profiles", currentUser.uid, "media"), { url, timestamp: new Date() });
    });
  }
}

function updateBio() {
  if (!currentUser) return alert("Please log in!");
  const bio = document.getElementById("bioInput").value.slice(0, 150);
  setDoc(doc(db, "profiles", currentUser.uid), { bio }, { merge: true });
}

onSnapshot(doc(db, "profiles", currentUser?.uid || "dummy"), (docSnap) => {
  const bioDisplay = document.getElementById("bioDisplay");
  if (bioDisplay && docSnap.exists()) bioDisplay.textContent = docSnap.data().bio || "No bio yet";
});

onSnapshot(query(collection(db, "profiles", currentUser?.uid || "dummy", "media"), orderBy("timestamp", "desc")), (snapshot) => {
  const mediaGrid = document.getElementById("mediaGrid");
  if (mediaGrid) {
    mediaGrid.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const el = data.url.includes("video") ? document.createElement("video") : document.createElement("img");
      el.src = data.url;
      if (el.tagName === "VIDEO") el.controls = true;
      mediaGrid.appendChild(el);
    });
  }
});

// --- Privacy & Follow ---
function togglePrivacy() {
  if (!currentUser) return alert("Please log in!");
  const isPrivate = document.getElementById("privacyToggle").checked;
  setDoc(doc(db, "profiles", currentUser.uid), { private: isPrivate }, { merge: true });
}

function followUser() {
  if (!currentUser) return alert("Please log in!");
  addDoc(collection(db, "profiles", currentUser.uid, "followers"), { followerId: "demoUser" });
  showNotification("Following (demo)!");
}

// --- Direct Messages ---
function sendDM() {
  if (!currentUser) return alert("Please log in!");
  const dmInput = document.getElementById("dmInput").value;
  if (dmInput) {
    addDoc(collection(db, "messages"), {
      text: dmInput,
      senderId: currentUser.uid,
      receiverId: "demoUser",
      timestamp: new Date()
    });
    document.getElementById("dmInput").value = "";
  }
}

onSnapshot(query(collection(db, "messages"), where("receiverId", "==", currentUser?.uid || "dummy"), orderBy("timestamp", "desc")), (snapshot) => {
  const dmList = document.getElementById("dmList");
  if (dmList) {
    dmList.innerHTML = "";
    snapshot.forEach((doc) => {
      const li = document.createElement("li");
      li.textContent = doc.data().text;
      dmList.appendChild(li);
    });
    showNotification("New message!");
  }
});

document.getElementById("dmInput")?.addEventListener("input", () => {
  const typing = document.getElementById("typingIndicator");
  if (typing) typing.textContent = "You are typing...";
  setTimeout(() => typing.textContent = "", 2000);
});

// --- Stories ---
function addStory() {
  if (!currentUser) return alert("Please log in!");
  const storyInput = document.getElementById("storyInput").files[0];
  if (storyInput) {
    uploadToCloudinary(storyInput, (url) => {
      const expiry = new Date().getTime() + 24 * 60 * 60 * 1000;
      addDoc(collection(db, "stories"), { url, userId: currentUser.uid, expiry, timestamp: new Date() });
    });
    document.getElementById("storyInput").value = "";
  }
}

onSnapshot(query(collection(db, "stories"), where("expiry", ">", new Date().getTime())), (snapshot) => {
  const storyList = document.getElementById("storyList");
  if (storyList) {
    storyList.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const el = data.url.includes("video") ? document.createElement("video") : document.createElement("img");
      el.src = data.url;
      if (el.tagName === "VIDEO") el.controls = true;
      storyList.appendChild(el);
    });
  }
});

// --- Explore ---
function updateExplore() {
  const exploreList = document.getElementById("exploreList");
  if (exploreList) {
    getDocs(query(collection(db, "posts"), orderBy("likes", "desc"))).then((snapshot) => {
      exploreList.innerHTML = "";
      snapshot.forEach((doc) => {
        const data = doc.data();
        const li = document.createElement("li");
        li.innerHTML = `${data.text || ""} ${data.media ? (data.media.includes("video") ? `<video src="${data.media}" controls></video>` : `<img src="${data.media}">`) : ""}`;
        exploreList.appendChild(li);
      });
    });
  }
}

// --- Notifications ---
function showNotification(message) {
  const notif = document.getElementById("notifications");
  if (notif) {
    notif.textContent = message;
    notif.style.display = "block";
    setTimeout(() => notif.style.display = "none", 3000);
  }
}

// --- Cloudinary Upload ---
function uploadToCloudinary(file, callback) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "Connectsphere"); // Your preset
  fetch("https://api.cloudinary.com/v1_1/dwhdglhha/auto/upload", { // Your cloud name
    method: "POST",
    body: formData
  })
    .then(response => response.json())
    .then(data => callback(data.secure_url))
    .catch(error => console.error("Error:", error));
      }
