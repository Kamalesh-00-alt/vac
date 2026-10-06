const API = "/api";
let currentUser = JSON.parse(localStorage.getItem("bantrUser")) || null;

//General helpers
const apiRequest = async (url, options = {}) => {
  const response = await fetch(`${API}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data;
};
const escapeHtml = (text = "") => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};
const getCurrentUsername = () => {
  return currentUser && currentUser.username ? currentUser.username : "";
};
const showMessage = (message) => {
  alert(message);
};

//Login
const login = async (e) => {
  if (e && e.preventDefault) e.preventDefault();
  try {
    const usernameInput = document.getElementById("auth-username");
    const passwordInput = document.getElementById("auth-password");

    const username = usernameInput ? usernameInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value.trim() : "";

    if (!username || !password) {
      return showMessage("Please fill in both a username and password.");
    }

    const data = await apiRequest("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    currentUser = data.user;
    localStorage.setItem("bantrUser", JSON.stringify(currentUser));

    const authScreen = document.getElementById("auth-screen");
    if (authScreen) authScreen.style.display = "none";

    await loadPosts();
    await loadProfile();
  } catch (error) {
    showMessage(error.message);
  }
};

//Register
const register = async (e) => {
  if (e && e.preventDefault) e.preventDefault();

  try {
    const usernameInput = document.getElementById("auth-username");
    const passwordInput = document.getElementById("auth-password");
    const nameInput = document.getElementById("auth-name");

    const username = usernameInput ? usernameInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value.trim() : "";
    const name = nameInput ? nameInput.value.trim() : "";

    if (!username || !password) {
      return showMessage("Please fill in both a username and password.");
    }

    const data = await apiRequest("/register", {
      method: "POST",
      body: JSON.stringify({ username, password, name }),
    });

    currentUser = data.user;
    localStorage.setItem("bantrUser", JSON.stringify(currentUser));

    const authScreen = document.getElementById("auth-screen");
    if (authScreen) authScreen.style.display = "none";

    await loadPosts();
    await loadProfile();

    showMessage("Account created!");
  } catch (error) {
    showMessage(error.message);
  }
};

//Logout
const logout = () => {
  localStorage.removeItem("bantrUser");
  currentUser = null;
  const authScreen = document.getElementById("auth-screen");
  if (authScreen) authScreen.style.display = "flex";
};

//View switching
const showView = async (viewName) => {
  const views = ["feed", "search", "create", "profile", "settings"];

  views.forEach((view) => {
    const element = document.getElementById(`${view}-view`);
    if (element) {
      element.style.display = view === viewName ? "block" : "none";
    }
  });

  if (viewName === "feed") {
    await loadPosts();
  }

  if (viewName === "profile") {
    await loadProfile();
  }

  if (viewName === "settings") {
    const userEl = document.getElementById("settings-user");
    if (userEl) userEl.textContent = `@${getCurrentUsername()}`;
  }
};

//Render one post
//Date formatting
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

//Genre Display
const formatGenre = (genre) => {
  if (!genre) return "Random";
  const genreMap = {
    popculture: "Pop Culture",
    memes: "Memes",
    music: "Music",
    movies: "Movies",
    gaming: "Gaming",
    art: "Art",
    photography: "Photography",
    fashion: "Fashion",
    technology: "Technology",
    politics: "Politics",
    sports: "Sports",
    books: "Books",
  };
  return genreMap[genre.toLowerCase()] || genre;
};

//Toggle comment drawer open/close
const toggleComments = (postId) => {
  const container = document.getElementById(`comments-container-${postId}`);
  if (container) {
    container.classList.toggle("open");
  }
};

//Render Post with hidden comments by default
const renderPost = (post) => {
  const isOwner = post.username === getCurrentUsername();
  const isLiked = post.likedBy
    ? post.likedBy.includes(getCurrentUsername())
    : false;

  const formattedTime = formatDate(post.createdAt || post.timestamp);
  const displayGenre = formatGenre(post.genre); // Dynamic tag formatting

  const commentsHtml = (post.comments || [])
    .map(
      (comment) => `
        <div class="comment">
          <strong>@${escapeHtml(comment.username)}</strong>
          ${escapeHtml(comment.text)}
        </div>
      `,
    )
    .join("");

  return `
    <article class="post-card">
      <div class="post-header">
        <strong>@${escapeHtml(post.username)}</strong>
        <span> · ${escapeHtml(post.genre)}</span>
        ${formattedTime ? `<span class="post-time">${formattedTime}</span>` : ""}
      </div>

      ${
        post.image
          ? `<img class="post-image" src="${escapeHtml(post.image)}" alt="Post image">`
          : ""
      }

      <div class="post-text">${escapeHtml(post.text)}</div>

      <div class="post-footer">
        <div class="action-row">
          <button class="action-btn" type="button" onclick="likePost('${post._id}')">
            ${isLiked ? "♥" : "♡"} ${post.likes || 0}
          </button>

          <button class="action-btn" type="button" onclick="toggleComments('${post._id}')">
            💬 ${(post.comments || []).length}
          </button>

          ${
            isOwner
              ? `<button class="action-btn" type="button" onclick="deletePost('${post._id}')">Delete</button>`
              : ""
          }
        </div>

        <!-- Collapsible Comments Drawer -->
        <div id="comments-container-${post._id}" class="comments-container">
          <div class="comment-box">
            <input id="comment-${post._id}" type="text" placeholder="Add a comment...">
            <button class="action-btn" type="button" onclick="commentPost('${post._id}')">Send</button>
          </div>

          <div class="comments">
            ${commentsHtml}
          </div>
        </div>
      </div>
    </article>
  `;
};

//Load home feed
const loadPosts = async () => {
  try {
    const posts = await apiRequest("/posts");
    const grid = document.getElementById("feed-grid");
    if (grid) {
      grid.innerHTML =
        posts.length > 0
          ? posts.map((post) => renderPost(post)).join("")
          : `<div class="empty-card">No posts yet. Create the first Bantr post.</div>`;
    }
  } catch (error) {
    showMessage(error.message);
  }
};

//Discover
const loadDiscover = async (genre) => {
  try {
    const normalizedGenre = genre.toLowerCase().trim();
    const posts = await apiRequest(`/discover/${normalizedGenre}`);
    const grid = document.getElementById("feed-grid");

    if (grid) {
      grid.innerHTML =
        posts.length > 0
          ? posts.map((post) => renderPost(post)).join("")
          : `<div class="empty-card">No posts found in ${formatGenre(normalizedGenre)}.</div>`;
    }
    showViewWithoutReload("feed");
  } catch (error) {
    showMessage(error.message);
  }
};

const showViewWithoutReload = (viewName) => {
  document.querySelectorAll(".view-section").forEach((view) => {
    view.style.display = "none";
  });
  const el = document.getElementById(`${viewName}-view`);
  if (el) el.style.display = "block";
};

//Create post
const createPost = async () => {
  try {
    const text = document.getElementById("post-text").value.trim();
    const image = document.getElementById("post-image").value.trim();
    const genre = document.getElementById("post-genre").value; // e.g. "politics"

    if (!text) {
      return showMessage("Write something before publishing.");
    }

    await apiRequest("/posts", {
      method: "POST",
      body: JSON.stringify({
        username: getCurrentUsername(),
        text,
        image,
        genre,
      }),
    });

    document.getElementById("post-text").value = "";
    document.getElementById("post-image").value = "";

    showMessage("Post published!");
    await showView("feed");
  } catch (error) {
    showMessage(error.message);
  }
};

//Like
const likePost = async (postId) => {
  try {
    await apiRequest(`/posts/${postId}/like`, {
      method: "POST",
      body: JSON.stringify({
        username: getCurrentUsername(),
      }),
    });

    await loadPosts();
  } catch (error) {
    showMessage(error.message);
  }
};

//Comment
const commentPost = async (postId) => {
  try {
    const input = document.getElementById(`comment-${postId}`);
    const text = input ? input.value.trim() : "";

    if (!text) return;

    await apiRequest(`/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({
        username: getCurrentUsername(),
        text,
      }),
    });

    await loadPosts();
  } catch (error) {
    showMessage(error.message);
  }
};

const focusComment = (postId) => {
  const input = document.getElementById(`comment-${postId}`);
  if (input) input.focus();
};

//Delete
const deletePost = async (postId) => {
  try {
    if (!confirm("Delete this post?")) return;

    await apiRequest(`/posts/${postId}`, {
      method: "DELETE",
      body: JSON.stringify({
        username: getCurrentUsername(),
      }),
    });

    await loadPosts();
    await loadProfile();
  } catch (error) {
    showMessage(error.message);
  }
};

//Profile
const loadProfile = async () => {
  try {
    const username = getCurrentUsername();
    if (!username) return;

    const data = await apiRequest(`/users/${username}`);

    const userEl = document.getElementById("profile-username");
    if (userEl) userEl.textContent = `@${data.user.username}`;

    const nameEl = document.getElementById("profile-name");
    if (nameEl) nameEl.textContent = data.user.name || data.user.username;

    const bioEl = document.getElementById("profile-bio");
    if (bioEl) bioEl.textContent = data.user.bio || "";

    //Count user's posts
    const postCountEl = document.getElementById("profile-post-count");
    if (postCountEl) postCountEl.textContent = data.posts.length;

    //Use fresh counts returned from API
    const likeCountEl = document.getElementById("profile-like-count");
    if (likeCountEl) likeCountEl.textContent = data.user.likes || 0;

    const commentCountEl = document.getElementById("profile-comment-count");
    if (commentCountEl) commentCountEl.textContent = data.user.comments || 0;

    const editName = document.getElementById("edit-name");
    if (editName) editName.value = data.user.name || "";

    const editBio = document.getElementById("edit-bio");
    if (editBio) editBio.value = data.user.bio || "";

    const profileFeed = document.getElementById("profile-feed");
    if (profileFeed) {
      profileFeed.innerHTML =
        data.posts.length > 0
          ? data.posts.map((post) => renderPost(post)).join("")
          : `<div class="empty-card">You have not created any posts yet.</div>`;
    }
  } catch (error) {
    showMessage(error.message);
  }
};

//Edit profile
const updateProfile = async () => {
  try {
    const name = document.getElementById("edit-name").value;
    const bio = document.getElementById("edit-bio").value;

    const data = await apiRequest(`/users/${getCurrentUsername()}`, {
      method: "PUT",
      body: JSON.stringify({ name, bio }),
    });

    currentUser.name = data.user.name;
    currentUser.bio = data.user.bio;

    localStorage.setItem("bantrUser", JSON.stringify(currentUser));

    await loadProfile();
    showMessage("Profile updated.");
  } catch (error) {
    showMessage(error.message);
  }
};

//DELETE ACCOUNT
const deleteAccount = async () => {
  try {
    if (
      !confirm(
        "Are you sure you want to delete your account? This will permanently delete all your posts as well.",
      )
    ) {
      return;
    }

    await apiRequest(`/users/${getCurrentUsername()}`, {
      method: "DELETE",
    });

    showMessage("Your account has been deleted.");
    logout();
  } catch (error) {
    showMessage(error.message);
  }
};

//Search
const searchBantr = async () => {
  try {
    const query = document.getElementById("search-input").value.trim();
    if (!query) return;

    const data = await apiRequest(`/search?q=${encodeURIComponent(query)}`);

    const usersHtml = data.users
      .map(
        (user) => `
          <div class="empty-card">
            <strong>@${escapeHtml(user.username)}</strong>
            <p>${escapeHtml(user.name || "")}</p>
          </div>
        `,
      )
      .join("");

    const postsHtml = data.posts.map((post) => renderPost(post)).join("");

    const resultsEl = document.getElementById("search-results");
    if (resultsEl) {
      resultsEl.innerHTML =
        usersHtml +
        (postsHtml || `<div class="empty-card">No matching posts.</div>`);
    }
  } catch (error) {
    showMessage(error.message);
  }
};

const searchOnEnter = (event) => {
  if (event.key === "Enter") {
    searchBantr();
  }
};

//Initial page load
const startApp = async () => {
  //C,lear broken or empty local storage entries
  if (!currentUser || !currentUser.username) {
    localStorage.removeItem("bantrUser");
    currentUser = null;
    const authScreen = document.getElementById("auth-screen");
    if (authScreen) authScreen.style.display = "flex";
    return;
  }

  const authScreen = document.getElementById("auth-screen");
  if (authScreen) authScreen.style.display = "none";

  await loadPosts();
  await loadProfile();
};
document.addEventListener("DOMContentLoaded", startApp);
