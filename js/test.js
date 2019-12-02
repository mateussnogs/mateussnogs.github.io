
var scene;
var camera;
var renderer;

var controls;

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
var plane = new THREE.Plane();
var guiPlane = new THREE.Plane();
var planeNormal = new THREE.Vector3();
var control_points = [];
var movingControlPoint = false;
var curvePoints = [];
var curveResolution = 100;

var gui = new dat.GUI();
var selectedPoint;
var selectedCurve;
var options = {
  tightness: 0.8,
  bezier: function() {
    drawCurve(bezier, getPointsPositions(control_points));
    selectedCurve = "bezier";
  },
  hermite: function() {
    hermiteState = true;
    selectedCurve = "hermite";
  },
  cardinal: function() {
    drawCardinalSplines(cardinal, getPointsPositions(control_points));
    selectedCurve = "cardinal";
  },
  catmullrom: function() {
    drawCardinalSplines(catmullrom, getPointsPositions(control_points));
    selectedCurve = "catmull";
  },
  clean: function() {
    control_points = [];
    hermDerivatives = [];
    hermiteStateNum = 0;
    arrowAdded = false;
    arrows = [];
    hermiteState = false; 
    while(scene.children.length > 0) { 
      scene.remove(scene.children[0]);      
    }
  },
  CleanCurve: function() {
    cleanCurve();
  },
};

gui.add(options, 'bezier');
gui.add(options, 'hermite');
gui.add(options, 'cardinal');
gui.add(options, 'catmullrom');
gui.add(options, 'tightness', 0, 1).listen().onChange(redrawCardinalSpline);
gui.add(options, 'clean');
gui.add(options, 'CleanCurve');

function redrawCardinalSpline() {
  if (selectedCurve == 'cardinal') {
    cleanCurve();
    drawCardinalSplines(cardinal, getPointsPositions(control_points));
  }
}
var init = function() {

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.z = 5;
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    // controls = new THREE.OrbitControls(camera, renderer.domElement);
    // document.body.appendChild( renderer.domElement );
    document.getElementById("scene").appendChild(renderer.domElement);
    document.getElementById("scene").addEventListener("mousedown", onMouseDown, false);
    document.getElementById("scene").addEventListener("mousemove", onMouseMove, false);
    document.getElementById("scene").addEventListener("mouseup", onMouseUp, false);

    this.render();

};


var render = function() {
    requestAnimationFrame( render ); 
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.render( scene, camera );
};

function factorial(n) {
  if (n == 0 || n == 1)
    return 1;
  return n*factorial(n-1);
}

function combination(k, i) {
  return factorial(k)/(factorial(k-i)*factorial(i));
}

function curveHasPoints() {
  for (var i = 0; i < scene.children.length; i++)
    if (scene.children[i].name == "curve")
      return i;
  return false;
}

function cleanCurve() {
  var i = curveHasPoints();
  while (i) {
    scene.remove(scene.children[i]);
    i = curveHasPoints();
  }
}

// array com cpoints vem no formato {'id', 'position'}
// essa funcao extrai as posicoes
function getPointsPositions(cpoints) {
  positions = [];
  for (var point of cpoints) {
    positions.push(point['position']);
  }
  return positions;
}

function bezier(cpoints) {
  points = []
  k = cpoints.length-1; // grau da curva
  for (u = 0; u <= 1; u += 0.001) {
    p = new THREE.Vector2();    
    for ( i = 0; i < k+1; i++) {
      cp = new THREE.Vector2(cpoints[i].x, cpoints[i].y);
      p = p.add(cp.multiplyScalar(combination(k, i) * Math.pow((1-u), k-i) * Math.pow(u, i)));
    }
    points.push(p);
  }
  return points;
}

var hermiteState = false;
function hermite(cpoints) { 
  p1 = new THREE.Vector2(cpoints[0].x, cpoints[0].y);
  d1 = new THREE.Vector2(cpoints[1].x, cpoints[1].y);
  p2 = new THREE.Vector2(cpoints[2].x, cpoints[2].y);
  d2 = new THREE.Vector2(cpoints[3].x, cpoints[3].y);
  points = [];  
  for (u = 0; u <= 1; u += 0.01) {    
    p = new THREE.Vector2(0, 0);
    h1 = 1 - 3*Math.pow(u, 2) + 2*Math.pow(u, 3);
    h2 = u - 2*Math.pow(u, 2) + Math.pow(u, 3);
    h3 = 3*Math.pow(u, 2) - 2*Math.pow(u, 3);
    h4 = Math.pow(u, 3) - Math.pow(u, 2);
    p.add(p1.clone().multiplyScalar(h1));
    p.add(d1.clone().multiplyScalar(h2));
    p.add(p2.clone().multiplyScalar(h3));
    p.add(d2.clone().multiplyScalar(h4));
    points.push(p);
  }         
  return points;
}

function catmullrom(cpoints) {
  options.tightness = 0.5;
  return cardinal(cpoints);
}

function cardinal(cpoints) {
  var p1 = new THREE.Vector2(cpoints[1].x, cpoints[1].y);
  var d1 = new THREE.Vector2(cpoints[2].x-cpoints[0].x, cpoints[2].y-cpoints[0].y);  
  d1 = d1.clone().multiplyScalar(options.tightness);
  var p2 = new THREE.Vector2(cpoints[2].x, cpoints[2].y);  
  var d2 = new THREE.Vector2(cpoints[3].x-cpoints[1].x, cpoints[3].y-cpoints[1].y);
  d2 = d2.clone().multiplyScalar(options.tightness);

  points = [];
  for (u = 0; u <= 1; u += 0.01) {    
    p = new THREE.Vector2(0, 0);
    h1 = 1 - 3*Math.pow(u, 2) + 2*Math.pow(u, 3);
    h2 = u - 2*Math.pow(u, 2) + Math.pow(u, 3);
    h3 = 3*Math.pow(u, 2) - 2*Math.pow(u, 3);
    h4 = Math.pow(u, 3) - Math.pow(u, 2);
    p.add(p1.clone().multiplyScalar(h1));
    p.add(d1.clone().multiplyScalar(h2));
    p.add(p2.clone().multiplyScalar(h3));
    p.add(d2.clone().multiplyScalar(h4));
    
    points.push(p);
  }
  return points;
}

function drawCardinalSplines(cardinalf, cpoints) {
  for (i = 0; i < cpoints.length-3; i++) {
    cardinal_points = [];
    for (j = i; j < i+4; j++) {
      cardinal_points.push(cpoints[j]);
    }
    drawCurve(cardinalf, cardinal_points);
  }
}

function changeCardinalCurves(cardinalf, cpoints) {
  for (i = 0; i < cpoints.length-3; i++) {
    cardinal_points = [];
    for (j = i; j < i+4; j++) {
      cardinal_points.push(cpoints[j]);
    }
    var new_points = cardinalf(getPointsPositions(cardinal_points));
    var v = 0;
    for (k = i*curveResolution; k < (i+1)*curveResolution; k++) {
      curvePoints[k].position.copy(new THREE.Vector3(new_points[v].x, new_points[v].y, 0));
      v++;
    }
  }
}

function drawCurve(blending, cpoints) {
    points = blending(cpoints);
    for (p of points) {
      p3d = new THREE.Vector3(p.x, p.y, 0);
      setPoint(p3d);
    }    
}

function changeCurve(blending, cpoints) {  
  var new_points = blending(getPointsPositions(cpoints));
  var i = 0;
  for (var i = 0; i < curvePoints.length; i++) {
    curvePoints[i].position.copy(new THREE.Vector3(new_points[i].x, new_points[i].y, 0));
  }
}

function drawPoints(points) {
  for (p of points) {
    p3d = new THREE.Vector3(p.x, p.y, 0);
    setPoint(p3d);
  } 
}

function hasClickedControlPoint() {
  var point = new THREE.Vector3();
  var raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse.clone(), camera);
  var intersects = raycaster.intersectObjects(scene.children);
  for ( var i = 0; i < intersects.length; i++ ) {
    if (intersects[i].object.name == 'cp')
		  intersects[i].object.material.color.set( 0xff0000 );
  }
  
  if (intersects.length > 0 && intersects[0].object.name == 'cp') {
    selectedPoint = intersects[0].object;
    return true;
  }
  return false;
}

function getPoint(event) {
    var point = new THREE.Vector3();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    planeNormal.copy(camera.position).normalize();
    plane.setFromNormalAndCoplanarPoint(planeNormal, scene.position);
    raycaster.setFromCamera(mouse.clone(), camera);
    raycaster.ray.intersectPlane(plane, point);    
    return point;
  }
  
  function setPoint(position, isControlPoint = false) {
    var radius = 0.01;
    var segments = 5;
    var name = "curve";
    if (isControlPoint) {
      radius *= 10;
      segments = 128;
      name = "cp";
    }
    var geometry = new THREE.CircleGeometry( radius , segments );
    var material = new THREE.MeshBasicMaterial( { color: 'white' } );
    var circle = new THREE.Mesh( geometry, material );
    circle.name = name;
    circle.position.copy(position);
    scene.add(circle);
    if (name=="curve")
      curvePoints.push(circle);
    return circle.id;
  }

  function finishHermite(cpoints) {
    hermiteState = false;
    hermPoints = [];
    j = 0;
    for(i = 0; i < cpoints.length-2; i++) {
      for (j = i; j < i+2; j++) {
        hermPoints.push(cpoints[j]);
        hermPoints.push(cpoints[j+cpoints.length/2]);
      }
      drawCurve(hermite, hermPoints);
      hermPoints = [];                    
    }
  }

  function changeHermite(cpoints) {
    hermiteState = false;
    hermPoints = [];
    j = 0;
    for(i = 0; i < cpoints.length-2; i++) {
      for (j = i; j < i+2; j++) {
        hermPoints.push(cpoints[j]);
        hermPoints.push(cpoints[j+cpoints.length/2]);
      }
      var new_points = hermite(getPointsPositions(hermPoints));
      var v = 0;
      for (var k = i*curveResolution; k < (i+1)*curveResolution; k++) {
        curvePoints[k].position.copy(new THREE.Vector3(new_points[v].x, new_points[v].y, 0));
        v++;
      }
      // drawCurve(hermite, hermPoints);
      hermPoints = [];                    
    }
  }
  
  var count = 0;
  function onMouseDown(event) {    
    if (document.activeElement.id != "corpo") { // resolve o problema do raycasting atingir a GUI
      return;
    }
    if (hermiteState) {
      hermiteStateNum++;
      control_points.push({'id': --pointId, 'position':dir});
      derivatives.push(arrowHelper);
      edges.push(edge);
      arrowAdded = false;      
      if (hermiteStateNum > (control_points.length-1)/2) {
        finishHermite(getPointsPositions(control_points));    
        hermiteState = false;    
      }
      return;
    }
    point = getPoint(event);
    if (!hasClickedControlPoint()) {      
      pointId = setPoint(point, isControlPoint=true);
      control_points.push({'id': pointId, 'position': new THREE.Vector2(point.x, point.y)});      
    } else {
      movingControlPoint = true;
    }
  }

  function onMouseUp(event) {
    if (document.activeElement.id != "corpo") { // resolve o problema do raycasting atingir a GUI
      return;
    }
    if (movingControlPoint) {
      movingControlPoint = false;
      selectedPoint.material.color.set( 'white' )
    }
  }
  
  var arrowHelper;
  var dir, edge;
  var arrowAdded = false;
  var hermiteStateNum = 0; // control point que será usado para pegar a derivada
  var derivatives = [];
  var edges = [];
  function onMouseMove(event) {
    if (hermiteState) {
      edge = getPoint(event);
      var origin = control_points[hermiteStateNum]['position'];
      origin = new THREE.Vector3(origin.x, origin.y, 0);
      dir = edge.clone().sub(origin);
  
      if (!arrowAdded) {        
        arrowAdded = true;
        length = 1;
        var hex = 0xffff00;    
        arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex );        
        scene.add( arrowHelper );
      }
      else {
        arrowHelper.setDirection(dir);
      }
    }
    if (movingControlPoint) {
        new_pos = getPoint(event);
        selectedPoint.position.copy(new_pos);
        // atualiza control points de acordo com o ponto em movimento
        for (var i = 0; i < control_points.length; i++) { 
          if (control_points[i]['id'] == selectedPoint.id) {
            control_points[i]['position'] = new THREE.Vector2(new_pos.x, new_pos.y);
            switch (selectedCurve) {
              case 'bezier':
                  changeCurve(bezier, control_points);
                  break;
              case 'hermite':
                  translateDerivatives(i);
                  changeHermite(control_points);                  
                  break;
              case 'cardinal':
                  changeCardinalCurves(cardinal, control_points);
                  break;
              case 'catmull':                  
                  changeCardinalCurves(catmullrom, control_points);
                  break;                                    
            }
          }
        }
    }
  }

function translateDerivatives(cpointIndex) {
  var numCp = control_points.length;
  var d = control_points[cpointIndex+numCp/2];
  var e = edges[cpointIndex];
  var cp = control_points[cpointIndex]['position'];
  control_points[cpointIndex+numCp/2] = {'id': d['id'], 'position': new THREE.Vector2(e.x-cp.x, e.y-cp.y)};

  derivatives[cpointIndex].position.copy(new THREE.Vector3(cp.x, cp.y, 0));
}
window.onload = this.init;