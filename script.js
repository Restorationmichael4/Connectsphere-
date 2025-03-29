let currentUser = null;

// --- Auth ---
function checkAuth() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const status = document.getElementById("userStatus");
    if (status) {
      status.textContent = user ? `Logged in as ${user.email}` : "Not logged in";
    }
    const isAuthPage = window.location.pathname.endsWith("auth.html");
    if (!user && !isAuthPage) {
      window.location.href = "auth.html";
    } else if (user && isAuthPage) {
      window.location.href = "index.html";
    }
  });
}
checkAuth();

function signUp() {
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      setDoc(doc(db, "profiles", userCredential.user.uid), { bio: "" })
        .then(() => window.location.href = "index.html")
        .catch((error) => alert("Profile setup failed: " + error.message));
    })
    .catch((error) => alert("Signup failed: " + error.message));
}

function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  signInWithEmailAndPassword(auth, email, password)
    .then(() => window.location.href = "index.html")
    .catch((error) => alert("Login failed: " + error.message));
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
  if (!currentUser) {
    alert("Please log in first!");
    window.location.href = "auth.html";
    return;
  }
  const postInput = document.getElementById("postInput").value;
  const mediaInput = document.getElementById("mediaInput").files[0];
  if (postInput || mediaInput) {
    const postData = { text: postInput, userId: currentUser.uid, timestamp: new Date(), likes: 0 };
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
      li.innerHTML = `${data.text || ""} ${data.media ? (data.media.includes("video") ? `<video src="${data.media}" controls></video>` : `<img src="${data.media}">`) : ""} 
        <button onclick="likePost('${doc.id}')">Like (${data.likes})</button>`;
      postList.appendChild(li);
    });
    showNotification("New post added!");
  }
});

function likePost(postId) {
  if (!currentUser) {
    alert("Please log in first!");
    window.location.href = "auth.html";
    return;
  }
  updateDoc(doc(db, "posts", postId), { likes: firebase.firestore.FieldValue.increment(1) });
}

// --- Profile Media & Bio ---
function uploadMedia() {
  if (!currentUser) {
    alert("Please log in first!");
    window.location.href = "auth.html";
    return;
  }
  const mediaInput = document.getElementById("profileMediaInput").files[0];
  if (mediaInput) {
    uploadToCloudinary(mediaInput, (url) => {
      addDoc(collection(db, "profiles", currentUser.uid, "media"), { url, timestamp: new Date() });
    });
  }
}

function updateBio() {
  if (!currentUser) {
    alert("Please log in first!");
    window.location.href = "auth.html";
    return;
  }
  const bio = document.getElementById("bioInput").value.slice(0, 150);
  setDoc(doc(db, "profiles", currentUser.uid), { bio }, { merge: true })
    .then(() => showNotification("Bio updated!"))
    .catch((error) => alert("Bio update failed: " + error.message));
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

// --- Direct Messages ---
function sendDM() {
  if (!currentUser) {
    alert("Please log in first!");
    window.location.href = "auth.html";
    return;
  }
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
  formData.append("upload_preset", "Connectsphere");
  fetch("https://api.cloudinary.com/v1_1/dwhdglhha/auto/upload", {
    method: "POST",
    body: formData
  })
    .then(response => response.json())
    .then(data => callback(data.secure_url))
    .catch(error => console.error("Error:", error));
}
