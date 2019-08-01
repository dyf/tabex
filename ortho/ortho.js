'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {
  let drifting = false;
  let gdata = null;
  let gquat = null;  

  $(document).ready(function () {
    tableau.extensions.initializeAsync().then(function() {
      // Add an event listener for the selection changed event on this sheet.
      // Assigning the event to a variable just to make the example fit on the page here.
      const markSelection = tableau.TableauEventType.MarkSelectionChanged;

      var mc = new Hammer.Manager($("#the_canvas")[0]);
      mc.add(new Hammer.Pan({ threshold:0, pointers:0 }))
      mc.add(new Hammer.Swipe()).recognizeWith(mc.get('pan'));
      mc.add(new Hammer.Press({ time: 0 })).recognizeWith(mc.get('pan')).recognizeWith(mc.get('swipe'));;
      mc.on("panstart panmove", onPan);
      mc.on("swipe", onSwipe);
      mc.on("press", onPress);

      $("#go_button").click(loadMarks);      
    });
  }, function (err) {
    // Something went wrong in initialization.
    console.log('Error while Initializing: ' + err.toString());
  });  

  function onPress(ev) {
    drifting = false;
  }

  function onPan(ev) {
    if ((ev.velocityX != 0) || (ev.velocityY != 0)) {
      let iquat = compute_interaction_quat(ev.velocityX*10, ev.velocityY*10);  
      drag(iquat);
      render();
    }
      
  }

  function onSwipe(ev) {
    if ((ev.velocityX != 0) || (ev.velocityY != 0)) {
      drifting = true;
      let iquat = compute_interaction_quat(ev.velocityX*5, ev.velocityY*5);  
      drift(iquat);
    }
  }
  
  function drift(quat) {
    
    function animate() {
      drag(quat);
      render();

      if (drifting) 
        requestAnimationFrame(animate);
    }

    animate();
  }
    
  function drag(quat) {
    gquat = quat.mul(gquat).normalize();
  }

  function compute_interaction_quat(dx, dy) {       
    // compute axis of rotation  
    let mag = Math.sqrt(dx*dx + dy*dy);
    let v_rot = [ dy/mag, -dx/mag, 0.0 ];
    let theta =  mag / 100.0 * (Math.PI / 2.0);
    return Quaternion.fromAxisAngle(v_rot, theta);    
  }
    
  function loadMarks(wsname) {
    gquat = Quaternion.fromAxisAngle([0,0,1], 0);

    // The first step in choosing a sheet will be asking Tableau what sheets are available
    const worksheet = getWorksheet("injections");

    // Call to get the selected marks for our sheet
    worksheet.getSummaryDataAsync({'ignoreSelection':true}).then(function (sumdata) {
      // Get the first DataTable for our selected marks (usually there is just one)
      const worksheetData = sumdata;

      // transpose the data
      let objs = worksheetData.data.map(function(item) {        
        
        let out = {}        
        worksheetData.columns.forEach(function(col, index) {
          
          out[col.fieldName] = item[index].value;
        });
        return out;
      });

      gdata = objs;
      render();
    });
  };

  function rotateData(data) {
      let center = [ 13200.0 * 0.5, 8000.0*0.5, 11400.0*0.5];

      return gdata.map(function(d) {        
        let pr = gquat.rotateVector([ d['ATTR(Injection X)']-center[0], 
                                      d['ATTR(Injection Y)']-center[1], 
                                      d['ATTR(Injection Z)']-center[2] ]);
        return { 'data': d,
                 'position': [ pr[0] + center[0],
                               pr[1] + center[1],
                               pr[2] + center[2] ] };
      }).sort(function(a,b) { return b['position'][2] - a['position'][2]});
  }

  function render() {
    let canvas_container = $("#canvas_container");

    let canvas = document.getElementById('the_canvas');
    canvas.width = canvas_container.innerWidth()-20;
    canvas.height = canvas_container.innerHeight()-20;

    let r_vert = $("#left_slider").val();
    let r_horz = $("#top_slider").val();        
    
    let context = canvas.getContext('2d');    

    let rdata = rotateData(gdata);
    
    rdata.forEach(function(injection, index) {                  
      let p = injection['position'];
      
      context.beginPath();
      context.arc(p[0] * 0.03+50, p[1] * 0.03+50, 
                  10.0 * Math.sqrt(injection['data']['ATTR(Injection Volume)']),
                  0, 2.0 * Math.PI);                        
      context.fillStyle = "rgb(" + injection['data']["Injection Rgb Triplet"].slice(1,-1) + ")";
      context.fill();
    });
    
  };

  function getWorksheet (worksheetName) {
    // Go through all the worksheets in the dashboard and find the one we want
    return tableau.extensions.dashboardContent.dashboard.worksheets.find(function (sheet) {
      return sheet.name === worksheetName;
    });
  };

})();

