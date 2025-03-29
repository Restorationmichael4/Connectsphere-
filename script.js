let currentUser = null;

function log(message) {
  console.log(message);
  const debug = document.getElementById("debug");
  if (debug) debug.textContent = message;
}

// --- Auth ---
function checkAuth() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    log(user ? `Logged in as ${user.email}` : "Not logged in");
    const isAuthPage = window.location.pathname.endsWith("auth.html");
    if (!user && !isAuthPage) {
      log("Redirecting to auth...");
      window.location.href = "auth.html";
    } else if (user && isAuthPage) {
      log("Redirecting to feed...");
      window.location.href = "index.html";
    }
  });
}
setTimeout(checkAuth, 500); // Delay to ensure auth loads

function signUp() {
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  if (!email || !password) {
    log("Email or password missing");
    alert("Please enter both email and password");
    return;
  }
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      log("User signed up: " + userCredential.user.uid);
      return setDoc(doc(db, "profiles", userCredential.user.uid), { bio: "" });
    })
    .then(() => {
      log("Profile created, redirecting...");
      window.location.href = "index.html";
    })
    .catch((error) => {
      log("Signup error: " + error.message);
      alert(error.message);
    });
}

function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) {
    log("Email or password missing");
    alert("Please enter both email and password");
    return;
  }
  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      log("Logged in, redirecting...");
      window.location.href = "index.html";
    })
    .catch((error) => {
      log("Login error: " + error.message);
      alert(error.message);
    });
}

function signOut() {
  signOut(auth)
    .then(() => {
      log("Signed out, redirecting...");
      window.location.href = "auth.html";
    })
    .catch((error) => log("Sign out error: " + error.message));
}

// --- Theme Toggle ---
function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
}
if (localStorage.getItem("theme") === "dark") toggleTheme();

// --- Feed ---
function addPost() {
  if (!currentUser) {
    log("Not logged in, redirecting...");
    alert("Please log in first!");
    window.location.href = "auth.html";
    return;
  }
  const postInput = document.getElementById("postInput").value;
  const mediaInput = document.getElementById("mediaInput").files[0];
  if (!postInput && !mediaInput) {
    log("No post content");
    alert("Please add text or media");
    return;
  }
  const postData = { text: postInput, userId: currentUser.uid, timestamp: new Date(), likes: 0 };
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
      `;
      postList.appendChild(li);
    });
    log("Feed updated");
  }
}, (error) => log("Feed error: " + error.message));

function likePost(postId) {
  if (!currentUser) {
    log("Not logged in, redirecting...");
    alert("Please log in first!");
    window.location.href = "auth.html";
    return;
  }
  updateDoc(doc(db, "posts", postId), { likes: firebase.firestore.FieldValue.increment(1) })
    .then(() => log("Post liked"))
    .catch((error) => log("Like error: " + error.message));
}

// --- Profile ---
function uploadMedia() {
  if (!currentUser) {
    log("Not logged in, redirecting...");
    alert("Please log in first!");
    window.location.href = "auth.html";
    return;
  }
  const mediaInput = document.getElementById("profileMediaInput").files[0];
  if (!mediaInput) {
    log("No media selected");
    alert("Please select a file");
    return;
  }
  uploadToCloudinary(mediaInput, (url) => {
    addDoc(collection(db, "profiles", currentUser.uid, "media"), { url, timestamp: new Date() })
      .then(() => log("Media uploaded"))
      .catch((error) => log("Upload error: " + error.message));
  });
}

function updateBio() {
  if (!currentUser) {
    log("Not logged in, redirecting...");
    alert("Please log in first!");
    window.location.href = "auth.html";
    return;
  }
  const bio = document.getElementById("bioInput").value.slice(0, 150);
  if (!bio) {
    log("No bio entered");
    alert("Please enter a bio");
    return;
  }
  setDoc(doc(db, "profiles", currentUser.uid), { bio }, { merge: true })
    .then(() => log("Bio updated"))
    .catch((error) => log("Bio error: " + error.message));
}

onSnapshot(doc(db, "profiles", currentUser?.uid || "dummy"), (docSnap) => {
  const bioDisplay = document.getElementById("bioDisplay");
  if (bioDisplay && docSnap.exists()) {
    bioDisplay.textContent = docSnap.data().bio || "No bio yet";
    log("Bio loaded");
  }
}, (error) => log("Bio load error: " + error.message));

onSnapshot(query(collection(db, "profiles", currentUser?.uid || "dummy", "media"), orderBy("timestamp", "desc")), (snapshot) => {
  const mediaGrid = document.getElementById("mediaGrid");
  if (mediaGrid) {
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
  }
}, (error) => log("Media error: " + error.message));

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
