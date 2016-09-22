/* global canvas, fullScreenButton, loopButton, muteButton, playL, playR, playButton, projectionSelect, quat, seekBar, webGL, video, videoSelect, vrHMD, vrSensor */

var reqAnimFrameID = 0;
var projection = 0;
var initialRotation = quat.create();
var inversedInitialRotation = quat.create();
var manualRotation = quat.create();
var mouseRotation = quat.create();
var degtorad = Math.PI / 180;  // Degree-to-Radian conversion

var audioCtx = null;
var gainNodeFrontL = null;
var gainNodeFrontR = null;
var gainNodeLeftL = null;
var gainNodeLeftR = null;
var gainNodeBackL = null;
var gainNodeBackR = null;
var gainNodeRightL = null;
var gainNodeRightR = null;

var frameCount = 0;

var mainVol = 1;

var lastMouseX = 0;
var lastMouseY = 0;
var mouseDown = false;
var mouseRotationMatrix;
var mouseOrientationX;
var mouseOrientationY;
var curMouseEulerX = 0;
var curMouseEulerY = 0;

(function(global) {
  'use strict';

  var videoObjectURL;

  var controls = {
    manualControls: {
      /*
      'a' : {index: 1, sign: 1, active: 0},
      'd' : {index: 1, sign: -1, active: 0},
      'w' : {index: 0, sign: 1, active: 0},
      's' : {index: 0, sign: -1, active: 0},
      'q' : {index: 2, sign: -1, active: 0},
      'e' : {index: 2, sign: 1, active: 0},
      */
    },

    manualRotateRate: new Float32Array([0, 0, 0]),  // Vector, camera-relative
    mouseRotateRate: new Float32Array([0, 0, 0]),  // Vector, mouse-relative

    create: function() {
      var eulerThree = new THREE.Euler( 0, 0, 0, 'XYZ' );
      //var eulerThree = new THREE.Euler( 0, 3.14, 0, 'XYZ' );
      var inversedEulerThree = new THREE.Euler( 0, 0, 0, 'XYZ' );
      //var inversedEulerThree = new THREE.Euler( 0, -3.14, 0, 'XYZ' );
      //var eulerThree = new THREE.Euler( 0, 1.57, 0, 'XYZ' );
      var quaternionThree = new THREE.Quaternion();
      quaternionThree.setFromEuler(eulerThree);
      var inversedQuaternionThree = new THREE.Quaternion();
      inversedQuaternionThree.setFromEuler(inversedEulerThree);
      initialRotation = [quaternionThree.x, quaternionThree.y, quaternionThree.z, quaternionThree.w];
      inversedInitialRotation = [inversedQuaternionThree.x, inversedQuaternionThree.y, inversedQuaternionThree.z, inversedQuaternionThree.w];

      playButton.addEventListener('click', function() {
        controls.playPause();
      });

      playL.addEventListener('click', function() {
        controls.playPause();
      });

      playR.addEventListener('click', function() {
        controls.playPause();
      });

      loopButton.addEventListener('click', function() {
        controls.toggleLooping();
      });

      muteButton.addEventListener('click', function() {
        if (video.muted === false) {
          controls.mute();
        } else {
          controls.unmute();
        }
      });

      fullScreenButton.addEventListener('click', function() {
        controls.fullscreen();
      });

      recenterButton.addEventListener('click', function() {
        if (typeof vrSensor !== 'undefined') {
          vrSensor.zeroSensor(); // Untested
        }
        else {
          quat.invert(manualRotation, webGL.getPhoneVR().rotationQuat());
        }
      });

      seekBar.addEventListener('change', function() {
        // Calculate the new time
        var time = video.duration * (seekBar.value / 100);
        video.currentTime = time;
      });

      video.addEventListener('timeupdate', function() {
        // don't update if paused,
        // we get last time update after seekBar mousedown pauses
        if (!video.paused) {
          // Calculate the slider value
          var value = (100 / video.duration) * video.currentTime;
          seekBar.value = value;
        }
      });

      // Pause the video when the slider handle is being dragged
      var tempPause = false;
      seekBar.addEventListener('mousedown', function() {
        if (!video.paused) {
          video.pause();
          tempPause = true;
        }
      });

      seekBar.addEventListener('mouseup', function() {
        if (tempPause) {
          video.play();
        }
      });

      videoSelect.addEventListener('change', function() {
        projection = videoSelect.value[0];
        projectionSelect.value = projection;

        // Remove the hash/querystring if there were custom video parameters.
        window.history.pushState('', document.title, window.location.pathname);

        controls.loadVideo(videoSelect.value.substring(1));

        var selectedOption = videoSelect.options[videoSelect.selectedIndex];
        if ('autoplay' in selectedOption.dataset) {
          controls.play();
        }
      });


      projectionSelect.addEventListener('change', function() {
        projection = projectionSelect.value;
      });

      document.getElementById('select-local-file').addEventListener('click', function(event) {
        event.preventDefault();
        controls.selectLocalVideo();
      });

      mouseRotationMatrix = mat4.create();
      mat4.identity(mouseRotationMatrix);

      var orientation = new THREE.Quaternion();
      orientation.setFromEuler(new THREE.Euler( 0, 0, 0, 'XYZ' ));
      mouseOrientationX = new Float32Array([orientation.x, orientation.y, orientation.z, orientation.w]);
      mouseOrientationY = new Float32Array([orientation.x, orientation.y, orientation.z, orientation.w]);

      canvas.onmousedown = function(event) {
        mouseDown = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
      };

      document.onmouseup = function(event) {
        mouseDown = false;
        //controls.mouseRotateRate[0] = 0;
        //controls.mouseRotateRate[1] = 0;
        //controls.mouseRotateRate[2] = 0;
      };

      document.onmousemove = function(event) {
         if (!mouseDown) {
           return;
         }

         var newX = event.clientX;
         var newY = event.clientY;

         //console.log("mouseX:" + newX + ", Y:" + newY);

         var deltaX = newX - lastMouseX;
         //var mouseRotationMatrix = mat4.create();
         //mat4.identity(mouseRotationMatrix);

         //mat4.rotate(mouseRotationMatrix, mouseRotationMatrix, deltaX / 10 / 180 * 3.14159265, [0, 1, 0]);

         var deltaY = newY - lastMouseY;
         //mat4.rotate(mouseRotationMatrix, mouseRotationMatrix, deltaY / 10 / 180 * 3.14159265, [1, 0, 0]);

         curMouseEulerX -= deltaX / 100;
         if(curMouseEulerX > 3.1415926)
            curMouseEulerX -= 6.2831852;
          if(curMouseEulerX < -3.1415926)
            curMouseEulerX += 6.2831852;

          curMouseEulerY -= deltaY / 100;
          if(curMouseEulerY > 1.57)
             curMouseEulerY = 1.57;
           if(curMouseEulerY < -1.57)
             curMouseEulerY = -1.57;

           var orientation = new THREE.Quaternion();
           //orientation.setFromEuler(new THREE.Euler( 1.5 - 3 * newY / canvas.height, 3.5 - 7 * newX / canvas.width, 0, 'XYZ' ));
           orientation.setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), curMouseEulerX );
           mouseOrientationY = new Float32Array([orientation.x, orientation.y, orientation.z, orientation.w]);

           orientation = new THREE.Quaternion();
           orientation.setFromAxisAngle( new THREE.Vector3( 1, 0, 0 ), curMouseEulerY );
           mouseOrientationX = new Float32Array([orientation.x, orientation.y, orientation.z, orientation.w]);

/*
         var orientation = new THREE.Quaternion();
         //orientation.setFromEuler(new THREE.Euler( 1.5 - 3 * newY / canvas.height, 3.5 - 7 * newX / canvas.width, 0, 'XYZ' ));
         orientation.setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), 3.5 - 7 * newX / canvas.width );
         mouseOrientationY = new Float32Array([orientation.x, orientation.y, orientation.z, orientation.w]);

         orientation = new THREE.Quaternion();
         orientation.setFromAxisAngle( new THREE.Vector3( 1, 0, 0 ), 1.5 - 3 * newY / canvas.height );
         mouseOrientationX = new Float32Array([orientation.x, orientation.y, orientation.z, orientation.w]);
*/
         //controls.mouseRotateRate[1] = (-deltaX / 10);
         //controls.mouseRotateRate[0] = (-deltaY / 20);
         //controls.mouseRotateRate[2] = 0;

         //console.log("deltaX:" + deltaX + ", deltaY:" + deltaY);
         //mat4.multiply(newRotationMatrix, moonRotationMatrix, moonRotationMatrix);

         lastMouseX = newX;
         lastMouseY = newY;
       };
    },

    enableKeyControls: function() {
      function key(event, sign) {
        var control = controls.manualControls[String.fromCharCode(event.keyCode).toLowerCase()];
        if (!control)
          return;
        if (sign === 1 && control.active || sign === -1 && !control.active)
          return;
        control.active = (sign === 1);
        controls.manualRotateRate[control.index] += sign * control.sign;
        //console.debug("fuck:" + sign);
      }

      function onkey(event) {
        switch (String.fromCharCode(event.charCode)) {
        case 'f':
          controls.fullscreen();
          break;
        case 'z':
          if (typeof vrSensor !== 'undefined') {
            vrSensor.zeroSensor();
          }
          else {
            quat.invert(manualRotation, webGL.getPhoneVR().rotationQuat());
          }
          break;
        case 'p':
          controls.playPause();
          break;
        case ' ': //spacebar
          controls.playPause();
          break;
        case 'g':
          controls.fullscreenIgnoreHMD();
          break;
        case 'l':
          controls.toggleLooping();
          break;
        }
      }

      document.addEventListener('keydown', function(event) { key(event, 1); },
              false);
      document.addEventListener('keyup', function(event) { key(event, -1); },
              false);
      window.addEventListener('keypress', onkey, true);
    },

    /**
     * Video Commands
     */
    loaded: function() {
      window.leftLoad.classList.add('hidden');
      window.rightLoad.classList.add('hidden');
      if (video.paused) {
        window.leftPlay.classList.remove('hidden');
        window.rightPlay.classList.remove('hidden');
      }

      controls.initHPS(video);
    },

    play: function() {
      if (video.ended) {
        video.currentTime = 0.1;
      }

      video.play();
      if (!video.paused) { // In case somehow hitting play button doesn't work.
        window.leftPlay.classList.add('hidden');
        window.rightPlay.classList.add('hidden');

        window.playButton.className = 'fa fa-pause icon';
        window.playButton.title = 'Pause';

        if (!reqAnimFrameID) {
          reqAnimFrameID = requestAnimationFrame(webGL.drawScene);
        }
      }
    },

    pause: function() {
      video.pause();

      window.playButton.className = 'fa fa-play icon';
      window.playButton.title = 'Play';

      window.leftPlay.classList.remove('hidden');
      window.rightPlay.classList.remove('hidden');
    },

    playPause: function() {
      if (video.paused === true) {
        controls.play();
      } else {
        controls.pause();
      }
    },

    setLooping: function(loop) {
      loop = !!loop;
      if (video.loop !== loop) {
        controls.toggleLooping();
      }
    },

    toggleLooping: function() {
      if (video.loop === true) {
        loopButton.className = 'fa fa-refresh icon';
        loopButton.title = 'Start Looping';
        video.loop = false;
      } else {
        loopButton.className = 'fa fa-chain-broken icon';
        loopButton.title = 'Stop Looping';
        video.loop = true;
      }
    },

    ended: function() {
      controls.pause();
      if (reqAnimFrameID) {
        cancelAnimationFrame(reqAnimFrameID);
        reqAnimFrameID = 0;
      }
    },

    mute: function() {
      if (video.muted) {
        return;
      }
      video.muted = true;
      window.muteButton.className = 'fa fa-volume-off icon';
      window.muteButton.title = 'Unmute';
    },

    unmute: function() {
      if (!video.muted) {
        return;
      }
      video.muted = false;
      window.muteButton.className = 'fa fa-volume-up icon';
      window.muteButton.title = 'Mute';
    },

    selectLocalVideo: function() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';

      input.addEventListener('change', function () {
        var files = input.files;
        if (!files.length) {
          // The user didn't select anything.  Sad.
          console.log('File selection canceled');
          return;
        }

        videoObjectURL = URL.createObjectURL(files[0]);
        console.log('Loading local file ', files[0].name, ' at URL ', videoObjectURL);
        videoSelect.value = '';
        controls.loadVideo(videoObjectURL);
      });

      input.click();
    },

    frameCB: function(cameraQuaternion) {
      if(audioCtx == null)
        return;

      var objectFront = new THREE.Vector3(0, 0, -1);
      //var objectFront = new THREE.Vector3(-1, 0, 0);
      var cameraFront = new THREE.Vector3(0, 0, -1);
      var inversedCameraQuaternion = quat.create();
      quat.multiply(inversedCameraQuaternion, inversedInitialRotation, cameraQuaternion);
      var cameraQuaternion3 = new THREE.Quaternion(inversedCameraQuaternion[0], inversedCameraQuaternion[1], inversedCameraQuaternion[2], inversedCameraQuaternion[3]);
      cameraFront.applyQuaternion(cameraQuaternion3);
      var cameraFrontXZ = new THREE.Vector3(cameraFront.x, 0, cameraFront.z);
      var angle = objectFront.angleTo(cameraFrontXZ);

      var crossProduct = new THREE.Vector3();
      crossProduct.crossVectors( objectFront, cameraFront );
      var isLeft = crossProduct.y >= 0 ? true : false;
      if(!isLeft)
      {
        angle = -angle;
      }

      //console.log("hello!\n");
      //console.debug("TR:" + cameraEuler.x + ", " + cameraEuler.y + ", " + cameraEuler.z);
      frameCount++;
      if(frameCount >= 10)
      {
        frameCount = 0;
      }

      if(frameCount == 0)
      {
        //console.log("cameraFront:" + cameraFront.x + ", " + cameraFront.y + ", " + cameraFront.z + ", angle:" + angle + ", isLeft:" + isLeft);
      }

      if(frameCount == 0)
      {
        var azimuth = angle;
        //var azimuth = cameraEuler.y;
/*
        azimuth -= Math.PI / 2;
        if(azimuth < -Math.PI)
        {
          azimuth += Math.PI;
        }
*/
        var frontVol = 0;
        var leftVol = 0;
        var backVol = 0;
        var rightVol = 0;

        if (azimuth <= Math.PI / 2 && azimuth >= 0)
    		{
          frontVol = Math.cos (azimuth) * mainVol;
          leftVol = Math.sin (azimuth) * mainVol;
          backVol = 0;
          rightVol = 0;
    		}
    		else if (azimuth > Math.PI / 2 && azimuth <= Math.PI)
    		{
          frontVol = 0;
          leftVol = Math.cos (azimuth - Math.PI / 2) * mainVol;
          backVol = Math.sin (azimuth - Math.PI / 2) * mainVol;
          rightVol = 0;
    		}
    		else if (azimuth < -Math.PI / 2 && azimuth >= -Math.PI)
    		{
          frontVol = 0;
          leftVol = 0;
          backVol = Math.sin (-azimuth - Math.PI / 2) * mainVol;
          rightVol = Math.cos (-azimuth - Math.PI / 2) * mainVol;
        }
        else if (azimuth < 0 && azimuth >= -Math.PI / 2)
    		{
          frontVol = Math.cos (-azimuth) * mainVol;
          leftVol = 0;
          backVol = 0;
          rightVol = Math.sin (-azimuth) * mainVol;
    		}

        gainNodeFrontL.gain.value = frontVol;
        gainNodeFrontR.gain.value = frontVol;
        gainNodeLeftL.gain.value = leftVol;
        gainNodeLeftR.gain.value = leftVol;
        gainNodeBackL.gain.value = backVol;
        gainNodeBackR.gain.value = backVol;
        gainNodeRightL.gain.value = rightVol;
        gainNodeRightR.gain.value = rightVol;

        //console.log("azimuth:" + azimuth + ", front:" + frontVol + ", left:" + leftVol + ", backVol:" + backVol + ", rightVol:" + rightVol);
      }
    },

    initHPS: function(mediaElement) {
      if(audioCtx != null)
        return;

      audioCtx = new AudioContext();
      gainNodeFrontL = audioCtx.createGain();
      gainNodeFrontR = audioCtx.createGain();
      gainNodeLeftL = audioCtx.createGain();
      gainNodeLeftR = audioCtx.createGain();
      gainNodeBackL = audioCtx.createGain();
      gainNodeBackR = audioCtx.createGain();
      gainNodeRightL = audioCtx.createGain();
      gainNodeRightR = audioCtx.createGain();

      var source = audioCtx.createMediaElementSource(video);

      if(source == null)
        console.log("source is null");

      var splitter = audioCtx.createChannelSplitter(8);
      source.connect(splitter);
console.log("source channel count:" + source.channelCount);
console.log("dest channel count:" + audioCtx.destination.channelCount);
      var merger = audioCtx.createChannelMerger(2);

      //front
      gainNodeFrontL.gain.value = 0;
      gainNodeFrontR.gain.value = 0;
      splitter.connect(gainNodeFrontL, 0, 0);
      splitter.connect(gainNodeFrontR, 1, 0);
      gainNodeFrontL.connect(merger, 0, 0);
      gainNodeFrontR.connect(merger, 0, 1);

      //left
      gainNodeLeftL.gain.value = 0;
      gainNodeLeftR.gain.value = 0;
      splitter.connect(gainNodeLeftL, 2, 0);  //1
      splitter.connect(gainNodeLeftR, 3, 0);  //6
      gainNodeLeftL.connect(merger, 0, 0);
      gainNodeLeftR.connect(merger, 0, 1);

      //back
      gainNodeBackL.gain.value = 0;
      gainNodeBackR.gain.value = 0;
      splitter.connect(gainNodeBackL, 4, 0);
      splitter.connect(gainNodeBackR, 5, 0);
      gainNodeBackL.connect(merger, 0, 0);
      gainNodeBackR.connect(merger, 0, 1);

      //right
      gainNodeRightL.gain.value = 1;
      gainNodeRightR.gain.value = 1;
      splitter.connect(gainNodeRightL, 6, 0); //5
      splitter.connect(gainNodeRightR, 7, 0); //3
      gainNodeRightL.connect(merger, 0, 0);
      gainNodeRightR.connect(merger, 0, 1);
/*
      //Things got a little messy because Wave 7.1 channel order is:

      //front left, front right, front center, LFE, back left, back right, side left, side right

      //while 7.1 Vorbis order is:

      //front left, front center, front right, side left, side right, back left, back right, LFE

      //front
      gainNodeFrontL.gain.value = 0;
      gainNodeFrontR.gain.value = 0;
      splitter.connect(gainNodeFrontL, 0, 0);
      splitter.connect(gainNodeFrontR, 2, 0);
      gainNodeFrontL.connect(merger, 0, 0);
      gainNodeFrontR.connect(merger, 0, 1);

      //left
      gainNodeLeftL.gain.value = 0;
      gainNodeLeftR.gain.value = 0;
      splitter.connect(gainNodeLeftL, 1, 0);  //1
      splitter.connect(gainNodeLeftR, 6, 0);  //6
      gainNodeLeftL.connect(merger, 0, 0);
      gainNodeLeftR.connect(merger, 0, 1);

      //back
      gainNodeBackL.gain.value = 0;
      gainNodeBackR.gain.value = 0;
      splitter.connect(gainNodeBackL, 7, 0);
      splitter.connect(gainNodeBackR, 4, 0);
      gainNodeBackL.connect(merger, 0, 0);
      gainNodeBackR.connect(merger, 0, 1);

      //right
      gainNodeRightL.gain.value = 1;
      gainNodeRightR.gain.value = 1;
      splitter.connect(gainNodeRightL, 5, 0); //5
      splitter.connect(gainNodeRightR, 3, 0); //3
      gainNodeRightL.connect(merger, 0, 0);
      gainNodeRightR.connect(merger, 0, 1);
*/
      merger.connect(audioCtx.destination);
    },

    loadVideo: function(videoFile) {
      controls.pause();
      window.leftPlay.classList.add('hidden');
      //window.rightPlay.classList.add('hidden');
      window.leftLoad.classList.remove('hidden');
      //window.rightLoad.classList.remove('hidden');

      webGL.gl.clear(webGL.gl.COLOR_BUFFER_BIT);

      if (reqAnimFrameID) {
        cancelAnimationFrame(reqAnimFrameID);
        reqAnimFrameID = 0;
      }

      // Hack to fix rotation for vidcon video for vidcon
      if (videoFile === 'videos/Vidcon.webm' || videoFile === 'videos/Vidcon5.mp4') {
        manualRotation = [0.38175851106643677, -0.7102527618408203, -0.2401944249868393, 0.5404701232910156];
      }
      /*
      else {
        var eulerThree = new THREE.Euler( 0, 3.14, 0, 'XYZ' );
        //var eulerThree = new THREE.Euler( 0, 1.57, 0, 'XYZ' );
        var quaternionThree = new THREE.Quaternion();
        quaternionThree.setFromEuler(eulerThree);
        manualRotation = [quaternionThree.x, quaternionThree.y, quaternionThree.z, quaternionThree.w];
        //manualRotation = new Float32Array([0, -0.885, 0]);
        //manualRotation = quat.create();
      }
*/
      var oldObjURL = videoObjectURL;
      videoObjectURL = null;

      video.src = videoFile;


      if (videoObjectURL && videoObjectURL !== videoFile) {
        URL.removeObjectURL(oldObjURL);
      }
    },

    fullscreen: function() {
      if (canvas.mozRequestFullScreen) {
        canvas.mozRequestFullScreen({ vrDisplay: vrHMD }); // Firefox
      } else if (canvas.webkitRequestFullscreen) {
        canvas.webkitRequestFullscreen({ vrDisplay: vrHMD }); // Chrome and Safari
      } else if (canvas.requestFullScreen){
        canvas.requestFullscreen();
      }
    },

    fullscreenIgnoreHMD: function() {
      if (canvas.mozRequestFullScreen) {
        canvas.mozRequestFullScreen(); // Firefox
      } else if (canvas.webkitRequestFullscreen) {
        canvas.webkitRequestFullscreen(); // Chrome and Safari
      } else if (canvas.requestFullScreen){
        canvas.requestFullscreen();
      }
    },

    hide: function() {
      window.videoControls.classList.add('hidden');
      window.messageL.classList.add('hidden');
      window.messageR.classList.add('hidden');
    },

    show: function() {
      window.videoControls.classList.remove('hidden');
      window.messageL.classList.remove('hidden');
      window.messageR.classList.remove('hidden');
    }
  };

  global.controls = controls;

})(window);
