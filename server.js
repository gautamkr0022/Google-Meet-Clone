const express = require("express");
const path = require("path");
const passport = require('passport')
//require(dotenv).config()
var app = express();
var server = app.listen(3000, function () {
  console.log("Listening on port 3000");
});
const dotenv = require('dotenv')
const fs = require('fs');
const fileUpload = require("express-fileupload");
require('./config/passport')(passport)
const session = require('express-session');
// After you declare "app"
const io = require("socket.io")(server, {
  allowEIO3: true, // false by default
});
dotenv.config({ path: './.env' })
app.use(express.static(path.join(__dirname, "")));
var userConnections = [];

app.use(session({ secret: 'melody hensley is my spirit animal' }));
app.use(express.urlencoded({ extended: true }))
const router = express.Router()
app.use(express.static('public'))
app.set('view engine', 'ejs');
app.use(passport.initialize())
app.use(passport.session())

app.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

app.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/dbet', scope: ['profile', 'email'] }),
  (req, res) => {
    res.redirect('/')
  }
)

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/tet', scope: ['profile', 'email'] }),
  (req, res) => {
    res.redirect('/')
  }
)

app.get('/logout', (req, res) => {
  req.logout(function (err) {
    if (err) {
      console.log(err)
      return next(err);
    }
    res.redirect('/');
  });
})

app.get('/', (req, res) => {
  res.render('action');
})

app.get('/meetingUrl', (req, res) => {
  ensureAuth(req, res, () => {
    res.render('index');
  });
})

function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  } else {
    res.redirect('/auth/google/callback/')
  }
}
function ensureGuest(req, res, next) {
  if (!req.isAuthenticated()) {
    return next();
  } else {
    res.redirect('/google/callback');
  }
}

io.on("connection", (socket) => {
  console.log("socket id is ", socket.id);

  socket.on("userconnect", (data) => {
    console.log("userconnent", data.displayName, data.meetingid);
    var other_users = userConnections.filter(
      (p) => p.meeting_id == data.meetingid
    );
    userConnections.push({
      connectionId: socket.id,
      user_id: data.displayName,
      meeting_id: data.meetingid,
    });
    var userCount = userConnections.length;
    console.log(userCount);
    other_users.forEach((v) => {
      socket.to(v.connectionId).emit("inform_others_about_me", {
        other_user_id: data.displayName,
        connId: socket.id,
        userNumber: userCount
      });
    });
    socket.emit("inform_me_about_other_user", other_users);
  });
  socket.on("SDPProcess", (data) => {
    socket.to(data.to_connid).emit("SDPProcess", {
      message: data.message,
      from_connid: socket.id,
    });
  });
  socket.on("sendMessage", (msg) => {
    console.log(msg);
    var mUser = userConnections.find((p) => p.connectionId == socket.id);
    if (mUser) {
      var meetingid = mUser.meeting_id;
      var from = mUser.user_id;
      var list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        socket.to(v.connectionId).emit("showChatMessage", {
          from: from,
          message: msg,
        });
      });
    }
  });
  socket.on("fileTransferToOther", (msg) => {
    console.log(msg);
    var mUser = userConnections.find((p) => p.connectionId == socket.id);
    if (mUser) {
      var meetingid = mUser.meeting_id;
      var from = mUser.user_id;
      var list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        socket.to(v.connectionId).emit("showFileMessage", {
          username: msg.username,
          meetingid: msg.meetingid,
          filePath: msg.filePath,
          fileName: msg.fileName,
        });
      });
    }
  });



  //DRAWINGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG
  socket.on('draw', (data) => {
    userConnections.forEach(con => {
      if (con.id != socket.id) {
        con.emit('ondraw', { x: data.x, y: data.y })
      }
    })
  })

  // socket.on('draw', (data) => {
  //   socket.broadcast.emit('ondraw', { x: data.x, y: data.y });

  // })  



  socket.on("disconnect", function () {
    console.log("Disconnected");
    var disUser = userConnections.find((p) => p.connectionId == socket.id);
    if (disUser) {
      var meetingid = disUser.meeting_id;
      userConnections = userConnections.filter(
        (p) => p.connectionId != socket.id
      );
      var list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        var userNumberAfUserLeave = userConnections.length;
        socket.to(v.connectionId).emit("inform_other_about_disconnected_user", {
          connId: socket.id,
          uNumber: userNumberAfUserLeave
        });
      });
    }
  });
});

app.use(fileUpload());

app.post("/attachimg", function (req, res) {
  var data = req.body;
  var imageFile = req.files.zipfile;
  console.log(imageFile);
  var dir = "public/attachment/" + data.meeting_id + "/";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  imageFile.mv(
    "public/attachment/" + data.meeting_id + "/" + imageFile.name,
    function (error) {
      if (error) {
        console.log("couldn't upload the image file , error: ", error);
      } else {
        console.log("Image file successfully uploaded");
      }
    }
  );
});
