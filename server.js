const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = 8888;
const MONGO_URL = "mongodb://127.0.0.1:27017/bantr";
app.use(cors());
app.use(express.json());
//Serve static files (CSS, JS) from root directory
app.use(express.static(__dirname));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "bantr.html"));
});
// MongoDB Connection
mongoose
  .connect(MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.log("MongoDB error:", error.message));

// Schemas & Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, default: "" },
  bio: { type: String, default: "" },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const commentSchema = new mongoose.Schema({
  username: String,
  text: String,
  createdAt: { type: Date, default: Date.now },
});

const postSchema = new mongoose.Schema({
  username: { type: String, required: true },
  text: { type: String, required: true },
  image: { type: String, default: "" },
  genre: { type: String, default: "random" },
  likes: { type: Number, default: 0 },
  likedBy: { type: [String], default: [] },
  comments: { type: [commentSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);

// Helper Functions
const cleanUsername = (username = "") => {
  if (typeof username !== "string") return "";
  return username.trim().toLowerCase().replace(/^@/, "");
};

function sendError(res, message, status = 400) {
  return res.status(status).json({ message });
}
//Routes
app.get("/api", (req, res) => {
  res.json({ message: "Bantr API is running" });
});

//Register Route
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, name } = req.body;

    if (
      !username ||
      !password ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return sendError(res, "Username and password are required.");
    }

    const cleanName = cleanUsername(username);

    if (!cleanName || !password.trim()) {
      return sendError(res, "Username and password cannot be empty.");
    }

    const existingUser = await User.findOne({ username: cleanName });

    if (existingUser) {
      return sendError(res, "Username already exists.");
    }

    const user = await User.create({
      username: cleanName,
      password: password.trim(),
      name: name ? name.trim() : cleanName,
    });

    res.json({
      message: "Registration successful.",
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Login Route
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      !username ||
      !password ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return sendError(res, "Username and password are required.");
    }

    const cleanName = cleanUsername(username);

    const user = await User.findOne({
      username: cleanName,
      password: password.trim(),
    });

    if (!user) {
      return sendError(res, "Invalid username or password.", 401);
    }

    res.json({
      message: "Login successful.",
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        bio: user.bio,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Get User Profile
app.get("/api/users/:username", async (req, res) => {
  try {
    const username = cleanUsername(req.params.username);
    const user = await User.findOne({ username });

    if (!user) {
      return sendError(res, "User not found.", 404);
    }

    const posts = await Post.find({ username }).sort({ createdAt: -1 });

    res.json({
      user: {
        username: user.username,
        name: user.name,
        bio: user.bio,
        likes: user.likes,
        comments: user.comments,
      },
      posts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Edit Profile
app.put("/api/users/:username", async (req, res) => {
  try {
    const username = cleanUsername(req.params.username);
    const { name, bio } = req.body;

    const user = await User.findOneAndUpdate(
      { username },
      { name, bio },
      { new: true },
    );

    if (!user) {
      return sendError(res, "User not found.", 404);
    }

    res.json({
      message: "Profile updated.",
      user: {
        username: user.username,
        name: user.name,
        bio: user.bio,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Get All Posts / Feed
app.get("/api/posts", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Create Post
app.post("/api/posts", async (req, res) => {
  try {
    const { username, text, image, genre } = req.body;
    const cleanName = cleanUsername(username);

    if (!cleanName || !text) {
      return sendError(res, "Username and post text are required.");
    }

    const user = await User.findOne({ username: cleanName });

    if (!user) {
      return sendError(res, "User not found.", 404);
    }

    const post = await Post.create({
      username: cleanName,
      text,
      image: image || "",
      genre: genre || "random",
    });

    res.json({
      message: "Post created.",
      post,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Delete post
app.delete("/api/posts/:id", async (req, res) => {
  try {
    const { username } = req.body;
    const cleanName = cleanUsername(username);

    const post = await Post.findById(req.params.id);

    if (!post) {
      return sendError(res, "Post not found.", 404);
    }

    if (cleanName !== post.username) {
      return sendError(res, "You can only delete your own posts.", 403);
    }

    //Delete the post
    await Post.findByIdAndDelete(req.params.id);

    //Recalculate total likes given by this user
    const totalLikes = await Post.countDocuments({ likedBy: cleanName });

    //Recalculate total comments left by this user across remaining posts
    const totalComments = await Post.countDocuments({
      "comments.username": cleanName,
    });

    //Update user stats in MongoDB
    await User.findOneAndUpdate(
      { username: cleanName },
      { likes: totalLikes, comments: totalComments },
    );

    res.json({ message: "Post deleted." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Like / Unlike Post
app.post("/api/posts/:id/like", async (req, res) => {
  try {
    const username = cleanUsername(req.body.username);
    const post = await Post.findById(req.params.id);

    if (!post) {
      return sendError(res, "Post not found.", 404);
    }

    const alreadyLiked = post.likedBy.includes(username);

    if (alreadyLiked) {
      post.likedBy = post.likedBy.filter((name) => name !== username);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.likedBy.push(username);
      post.likes += 1;
    }

    await post.save();

    await User.findOneAndUpdate(
      { username },
      { likes: await Post.countDocuments({ likedBy: username }) },
    );

    res.json({
      likes: post.likes,
      liked: !alreadyLiked,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Add Comment
app.post("/api/posts/:id/comments", async (req, res) => {
  try {
    const username = cleanUsername(req.body.username);
    const text = (req.body.text || "").trim();

    if (!username || !text) {
      return sendError(res, "Username and comment are required.");
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return sendError(res, "Post not found.", 404);
    }

    post.comments.push({ username, text });
    await post.save();

    await User.findOneAndUpdate(
      { username },
      {
        comments: await Post.countDocuments({ "comments.username": username }),
      },
    );

    res.json({
      message: "Comment added.",
      comments: post.comments,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Discover by Genre
app.get("/api/discover/:genre", async (req, res) => {
  try {
    const genre = req.params.genre.toLowerCase();

    const posts =
      genre === "all"
        ? await Post.find().sort({ createdAt: -1 })
        : await Post.find({ genre }).sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Search
app.get("/api/search", async (req, res) => {
  try {
    const query = (req.query.q || "").trim();

    if (!query) {
      return res.json({ users: [], posts: [] });
    }

    const regex = new RegExp(query, "i");

    const users = await User.find({
      $or: [{ username: regex }, { name: regex }],
    }).select("username name bio");

    const posts = await Post.find({
      $or: [{ text: regex }, { genre: regex }, { username: regex }],
    }).sort({ createdAt: -1 });

    res.json({ users, posts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Bantr running at http://localhost:${PORT}`);
});
