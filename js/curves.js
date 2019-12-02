
var scene;
var camera;
var renderer;

var controls;

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
var plane = new THREE.Plane();
var planeNormal = new THREE.Vector3();

// array central que eh utilizado ao longo do programa todo para acessar e modificar os pontos de controle
var controlPoints = [];

var movingControlPoint = false;

// array que armazena os pontos da curva desenhada utilizado para alterar a curva quando algum ponto de controle é movido
var curvePoints = [];

// numero de pontos por spline
var curveResolution = 1000;

var gui = new dat.GUI();
var selectedPoint;

// armazena a curva sendo desenhada para saber qual aplicar no movimento dos pontos de controle
var selectedCurve;

/* Variaveis que auxiliam na construcao das hermite splines
 pela necessidade de especificar as derivadas nos pontos de controle.
 */
var hermiteState = false; // determina se um usuario esta, ou nao, especificando as derivadas nos pts de controle
var arrowHelper; // derivada
var dir, edge; // direcao e ponta do vetor que especifica a derivada
var arrowAdded = false;
var hermiteStateNum = 0; // indice do potno de controle que será usado para associar uma derivada
var derivatives = []; // array usado para alterar as derivadas quando um pto de controle associado é reposicionado
var edges = []; // pontas das derivadas para poder reconstrui-las apos reposicionamento de pts de controle

var drawMode = true;
var is3d = false;

// opcoes da GUI
var options = {
  tightness: 0.8,
  orbitControls: false,
  bezier: function() {
    cleanCurve();
    drawCurve(bezier, getPointsPositions(controlPoints));
    selectedCurve = "bezier";
  },
  hermite: function() {
    cleanCurve();
    hermiteState = true;
    selectedCurve = "hermite";
  },
  cardinal: function() {
    cleanCurve();
    drawCardinalSplines(cardinal, getPointsPositions(controlPoints));
    selectedCurve = "cardinal";
  },
  catmullrom: function() {
    cleanCurve();
    drawCardinalSplines(catmullrom, getPointsPositions(controlPoints));
    selectedCurve = "catmull";
  },
  _3D: false,
  OrbitControls: false,
  clean: function() {
    controlPoints = [];
    curvePoints = [];
    selectedCurve = null;
    selectedPoint = null;
    cleanHermite();
    while(scene.children.length > 0) { 
      scene.remove(scene.children[0]);      
    }
  },
  CleanCurve: function() {
    cleanCurve();
  },
};

function to3D() {
  is3d = !is3d;
  if (is3d) {
    drawMode = false;
    drawAxes();
    camera.rotation.x = -Math.PI/8;
    camera.rotation.y = -Math.PI/6;
    camera.rotation.z = -Math.PI/4;
  } else {
    removeAxes();
    resetCamera();
    drawMode = true;
  }
}

function resetCamera() {
  camera.rotation.x = 0;
  camera.rotation.y = 0;
  camera.rotation.z = 0;
  camera.lookAt(scene.position);
  this.render();
}

function drawAxes() {
  var material = new THREE.LineBasicMaterial( { color: 0x0000ff } );
  var geometry = new THREE.Geometry();
  geometry.vertices.push(new THREE.Vector3( 0, 0, 0) );
  geometry.vertices.push(new THREE.Vector3( 0, 1.5*500, 0) );
  geometry.vertices.push(new THREE.Vector3( 0, 0, 0) );
  var line = new THREE.Line( geometry, material );
  line.name = "ax";
  scene.add( line );

  var material = new THREE.LineBasicMaterial( { color: 'red' } );
  var geometry = new THREE.Geometry();
  geometry.vertices.push(new THREE.Vector3( 1.5*500, 0, 0) );
  geometry.vertices.push(new THREE.Vector3( 0, 0, 0) );
  geometry.vertices.push(new THREE.Vector3( 0, 0, 0) );
  var line = new THREE.Line( geometry, material );
  line.name = "ax";
  scene.add( line );

  var material = new THREE.LineBasicMaterial( { color: 'green' } );
  var geometry = new THREE.Geometry();
  geometry.vertices.push(new THREE.Vector3( 0, 0, 0) );
  geometry.vertices.push(new THREE.Vector3( 0, 0, 0) );
  geometry.vertices.push(new THREE.Vector3( 0, 0, 1.5*500) );
  var line = new THREE.Line( geometry, material );
  line.name = "ax";
  scene.add( line );
}

function fillGUI() {
  gui.add(options, 'bezier').name("Bezier");
  gui.add(options, 'hermite').name("Hermite Splines");
  gui.add(options, 'cardinal').name("Cardinal Splines");
  gui.add(options, 'catmullrom').name("Catmull-Rom");
  gui.add(options, 'tightness', 0, 1).name('Tightness').listen().onChange(redrawCardinalSpline);
  gui.add(options, 'clean').name("Clean");
  gui.add(options, 'CleanCurve').name("Clean curve");
  gui.add(options, '_3D').name("3D").listen().onChange(to3D);
  gui.add(options, 'OrbitControls').name("Orbit Controls").listen().onChange(activateOrbitControls);
}
fillGUI();

function sceneHasAxes() {
  for (var i = 0 ; i < scene.children.length; i++)
    if (scene.children[i].name == "ax")
      return i;
  return -1;
}
function removeAxes() { 
  var indexToRemove = sceneHasAxes();
  while (indexToRemove > -1) {
    scene.remove(scene.children[indexToRemove]);
    indexToRemove = sceneHasAxes();
  }
}

function activateOrbitControls() {
  drawMode = false;  
  controls.noRotate = !controls.noRotate;
  if (controls.noRotate == true) {
    resetCamera();    
    removeAxes();
    drawMode = true;
  }
}

function cleanHermite() {
  derivatives = [];
  edges = [];
  hermiteStateNum = 0;
  arrowAdded = false;
  arrows = [];
  hermiteState = false; 
}


/* funcao chamada toda vez que o parametro tightness eh modificado na GUI.
Como o parametro eh utilizado apenas para cardinal splines,
somente para esse tipo de curva essa funcao tem efeito.
*/
function redrawCardinalSpline() {
  if (selectedCurve == 'cardinal') {
    cleanCurve();
    drawCardinalSplines(cardinal, getPointsPositions(controlPoints));
  }
}
var init = function() {

    scene = new THREE.Scene();
    // camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera = new THREE.OrthographicCamera( window.innerWidth / - 2, 
      window.innerWidth/ 2, window.innerHeight / 2, window.innerHeight / - 2 , -100, 200);
    camera.position.z = 5;
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.noRotate = true;
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

// procura qualquer ponto da curva que ainda esta na cena e retorna o indice do objeto na cena
function curveHasPoints() {
  for (var i = 0; i < scene.children.length; i++)
    if (scene.children[i].name == "curve")
      return i;
  return false;
}

// procura e remove pontos de curva ate que nao haja nenhum
function cleanCurve() {
  curvePoints = [];
  cleanHermite();
  selectedCurve = null;
  selectedPoint = null;

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

// aplica bezier em todos os pontos de controle e retorna os pontos que compoem a curva
function bezier(cpoints) {
  points = []
  k = cpoints.length-1; // grau da curva
  for (u = 0; u <= 1; u += 1/curveResolution) {
    p = new THREE.Vector2();    
    for ( i = 0; i < k+1; i++) {
      cp = new THREE.Vector2(cpoints[i].x, cpoints[i].y);
      p = p.add(cp.multiplyScalar(combination(k, i) * Math.pow((1-u), k-i) * Math.pow(u, i)));
    }
    points.push(p);
  }
  return points;
}

// aplica hermite em 4 pontos de controle para compor uma hermite spline
function hermite(cpoints) { 
  p1 = new THREE.Vector2(cpoints[0].x, cpoints[0].y);
  d1 = new THREE.Vector2(cpoints[1].x, cpoints[1].y);
  p2 = new THREE.Vector2(cpoints[2].x, cpoints[2].y);
  d2 = new THREE.Vector2(cpoints[3].x, cpoints[3].y);
  points = [];  
  for (u = 0; u <= 1; u += 1/curveResolution) {    
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

// Aplica catmullrom em 4 pontos de controle para compor uma catmullrom spline.
// Eh um caso particular de cardinal spline.
function catmullrom(cpoints) {
  options.tightness = 0.5;
  return cardinal(cpoints);
}

// Aplica catmullrom em 4 pontos de controle para compor uma cardinal spline.
function cardinal(cpoints) {
  var p1 = new THREE.Vector2(cpoints[1].x, cpoints[1].y);
  var d1 = new THREE.Vector2(cpoints[2].x-cpoints[0].x, cpoints[2].y-cpoints[0].y);  
  d1 = d1.clone().multiplyScalar(options.tightness);
  var p2 = new THREE.Vector2(cpoints[2].x, cpoints[2].y);  
  var d2 = new THREE.Vector2(cpoints[3].x-cpoints[1].x, cpoints[3].y-cpoints[1].y);
  d2 = d2.clone().multiplyScalar(options.tightness);

  points = [];
  for (u = 0; u <= 1; u += 1/curveResolution) {    
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

// Considera todos os pontos de controle para desenhar todas as cardinal splines.
function drawCardinalSplines(cardinalf, cpoints) {
  for (i = 0; i < cpoints.length-3; i++) {
    cardinal_points = [];
    for (j = i; j < i+4; j++) {
      cardinal_points.push(cpoints[j]);
    }
    drawCurve(cardinalf, cardinal_points);
  }
}

// Muda os pontos das cardinal splines caso algum ponto de controle tenha sido reposicionado.
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

// Desenha uma curva completa (e.g. bezier) ou uma spline determinada pelo parametro blending.
function drawCurve(blending, cpoints) {
    points = blending(cpoints);
    for (p of points) {
      p3d = new THREE.Vector3(p.x, p.y, 0);
      setPoint(p3d);
    }    
}

// Muda os pontos de uma curva de bezier ja existente caso algum ponto de controle tenha sido reposicionado.
function changeBezierCurve(blending, cpoints) {  
  var new_points = blending(getPointsPositions(cpoints));
  var i = 0;
  for (var i = 0; i < curvePoints.length; i++) {
    curvePoints[i].position.copy(new THREE.Vector3(new_points[i].x, new_points[i].y, 0));
  }
}

// Checa se algum ponto de controle foi clicado e o seleciona.
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

// Retorna a posicao do mouse na tela.
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
  
  /* Desenha um circulo, representando um ponto, em uma determinada posicao
   Retorna o id dele para poder atualizar a posicao do ponto de controle quando alterada.
   */
  function setPoint(position, isControlPoint = false) {
    if (!drawMode)
      return;
    var radius = 1;
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

  /*
  Chamada apos o usuario terminar de especificar todas as derivadas relacionadas aos pontos de controle.
  */
  function finishHermiteSplines(cpoints) {
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

  /*
  Muda os pontos das hermite splines ja desenhadas caso algum ponto de controle tenha sido reposicionado.
  */
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
      hermPoints = [];                    
    }
  }
  
  // Chamada ao clicar.
  function onMouseDown(event) {    
    if (document.activeElement.id != "corpo") { // resolve o problema do raycast atingir a GUI
      console.log(document.activeElement.id);
      return;
    }
    if (hermiteState) {
      hermiteStateNum++; // passa para a especificacao da derivada do proximo pto de controle!
      controlPoints.push({'id': --pointId, 'position':dir}); // derivadas tbm sao ptos de controle
      derivatives.push(arrowHelper); // guarda seta/derivada para poder reposicionar junto com o pto de controle
      edges.push(edge);
      arrowAdded = false; // uma nova seta podera ser adicionada de novo
      numCpointsWithoutDerivatives = (controlPoints.length-1)/2;
      if (hermiteStateNum > numCpointsWithoutDerivatives) {
        finishHermiteSplines(getPointsPositions(controlPoints));    
        hermiteState = false;    
      }
      return;
    }
    point = getPoint(event);
    // se nao houve clique em um ponto de controle, entao um novo ponto de controle esta sendo adicionado
    if (!hasClickedControlPoint()) {      
      pointId = setPoint(point, isControlPoint=true);
      controlPoints.push({'id': pointId, 'position': new THREE.Vector2(point.x, point.y)});      
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
  
  function findCPointById(id) {
    cpointIndex = -1;
    for (var i = 0; i < controlPoints.length; i++) { 
      if (controlPoints[i]['id'] == id) {         
        cpointChangedIndex = i;
        return i;
      }
    }
    return cpointIndex;
  }

  function onMouseMove(event) {
    if (hermiteState) {
      edge = getPoint(event);
      var origin = controlPoints[hermiteStateNum]['position'];
      origin = new THREE.Vector3(origin.x, origin.y, 0);
      dir = edge.clone().sub(origin);
  
      if (!arrowAdded) {        
        arrowAdded = true;
        length = 100;
        var hex = 0xffff00;    
        arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex );        
        scene.add( arrowHelper );
      }
      else {
        arrowHelper.setDirection(dir.clone().multiplyScalar(1/length)); // se a seta ja esta na cena, mude a direcao quando mover o mouse
      }
    }
    if (movingControlPoint) {
        new_pos = getPoint(event);
        selectedPoint.position.copy(new_pos);
        cpointChangedIndex = findCPointById(selectedPoint.id);
        if (cpointChangedIndex > -1) {  
          controlPoints[cpointChangedIndex]['position'] = new THREE.Vector2(new_pos.x, new_pos.y);          
          switch (selectedCurve) {
            case 'bezier':
                changeBezierCurve(bezier, controlPoints);
                break;
            case 'hermite':
                translateDerivatives(cpointChangedIndex);
                changeHermite(controlPoints);                  
                break;
            case 'cardinal':
                changeCardinalCurves(cardinal, controlPoints);
                break;
            case 'catmull':                  
                changeCardinalCurves(catmullrom, controlPoints);
                break;                                    
          }
      }
    }
  }

// Faz as derivadas acompanharem seus pontos de controle associados.
function translateDerivatives(cpointIndex) {
  var numCp = controlPoints.length;
  var d = controlPoints[cpointIndex+numCp/2];
  var e = edges[cpointIndex];
  var cp = controlPoints[cpointIndex]['position'];
  controlPoints[cpointIndex+numCp/2] = {'id': d['id'], 'position': new THREE.Vector2(e.x-cp.x, e.y-cp.y)};

  derivatives[cpointIndex].position.copy(new THREE.Vector3(cp.x, cp.y, 0));
}
window.onload = this.init;