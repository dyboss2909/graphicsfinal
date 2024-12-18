// Vertex shader program
var VSHADER_SOURCE = 
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'varying vec4 v_Color;\n' +
  'uniform mat4 u_MvpMatrix;\n' +
  'uniform mat4 u_ModelMatrix;\n' +
  'void main() {\n' +
  '  gl_Position = u_MvpMatrix * u_ModelMatrix * a_Position;\n' +
  '  v_Color = a_Color;\n' +
  '}\n';

// Fragment shader program
var FSHADER_SOURCE =
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_FragColor = v_Color;\n' +
  '}\n';

function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders.');
    return;
  }

  // Set vertex information
  var n = initVertexBuffers(gl);
  if (n < 0) {
    console.log('Failed to set the vertex information');
    return;
  }

  // Set clear color and enable depth test
  gl.clearColor(0.5, 0.5, 0.5, 1.0);
  gl.enable(gl.DEPTH_TEST);

  // Get the storage locations of uniform variables
  var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  var u_MvpMatrix = gl.getUniformLocation(gl.program, 'u_MvpMatrix');
  
  if (!u_ModelMatrix || !u_MvpMatrix) {
    console.log('Failed to get the storage location of uniforms');
    return;
  }

  // Calculate the view projection matrix
  var viewProjMatrix = new Matrix4();
  viewProjMatrix.setPerspective(40.0, canvas.width / canvas.height, 1.0, 100.0);
  viewProjMatrix.lookAt(0.0, 0.0, 5.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);

  // Current angles of rotation for each cube
  var yAngle = 0.0;  // For cube 1
  var xAngle = 0.0;  // For cube 4
  var xOffset = 0.0; // For cube 2 translation
  var zScale = 1.0;  // For cube 3 scaling
  var scaleDirection = 1; // 1 for increasing, -1 for decreasing
  var moveDirection = 1;  // 1 for right, -1 for left

  // Start drawing
  var tick = function() {
    // Update rotation angles
    yAngle = (yAngle + 0.5) % 360;
    xAngle = (xAngle + 0.5) % 360;
    
    // Update translation
    xOffset += 0.01 * moveDirection;
    if (Math.abs(xOffset) >= 0.3) {
      moveDirection *= -1;
    }
    
    // Update scaling
    zScale += 0.005 * scaleDirection;
    if (zScale >= 1.2 || zScale <= 0.8) {
      scaleDirection *= -1;
    }

    // Draw the cubes
    draw(gl, n, viewProjMatrix, u_ModelMatrix, u_MvpMatrix, 
         yAngle, xAngle, xOffset, zScale);
    
    requestAnimationFrame(tick);
  };
  tick();
}

function initVertexBuffers(gl) {
  // Create a cube
  //    v6----- v5
  //   /|      /|
  //  v1------v0|
  //  | |     | |
  //  | |v7---|-|v4
  //  |/      |/
  //  v2------v3
  var vertices = new Float32Array([
    0.5, 0.5, 0.5,  -0.5, 0.5, 0.5,  -0.5,-0.5, 0.5,   0.5,-0.5, 0.5,  // front
    0.5, 0.5, 0.5,   0.5,-0.5, 0.5,   0.5,-0.5,-0.5,   0.5, 0.5,-0.5,  // right
    0.5, 0.5, 0.5,   0.5, 0.5,-0.5,  -0.5, 0.5,-0.5,  -0.5, 0.5, 0.5,  // up
   -0.5, 0.5, 0.5,  -0.5, 0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5,-0.5, 0.5,  // left
   -0.5,-0.5,-0.5,   0.5,-0.5,-0.5,   0.5,-0.5, 0.5,  -0.5,-0.5, 0.5,  // down
    0.5,-0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5, 0.5,-0.5,   0.5, 0.5,-0.5   // back
  ]);

  // Colors
  var colors = new Float32Array([
    0.4, 0.4, 1.0, 1.0,  0.4, 0.4, 1.0, 1.0,  0.4, 0.4, 1.0, 1.0,  0.4, 0.4, 1.0, 1.0,  // front
    0.4, 1.0, 0.4, 1.0,  0.4, 1.0, 0.4, 1.0,  0.4, 1.0, 0.4, 1.0,  0.4, 1.0, 0.4, 1.0,  // right
    1.0, 0.4, 0.4, 1.0,  1.0, 0.4, 0.4, 1.0,  1.0, 0.4, 0.4, 1.0,  1.0, 0.4, 0.4, 1.0,  // up
    1.0, 1.0, 0.4, 1.0,  1.0, 1.0, 0.4, 1.0,  1.0, 1.0, 0.4, 1.0,  1.0, 1.0, 0.4, 1.0,  // left
    1.0, 0.4, 1.0, 1.0,  1.0, 0.4, 1.0, 1.0,  1.0, 0.4, 1.0, 1.0,  1.0, 0.4, 1.0, 1.0,  // down
    0.4, 1.0, 1.0, 1.0,  0.4, 1.0, 1.0, 1.0,  0.4, 1.0, 1.0, 1.0,  0.4, 1.0, 1.0, 1.0   // back
  ]);

  // Indices of the vertices
  var indices = new Uint8Array([
    0, 1, 2,   0, 2, 3,    // front
    4, 5, 6,   4, 6, 7,    // right
    8, 9,10,   8,10,11,    // up
    12,13,14,  12,14,15,    // left
    16,17,18,  16,18,19,    // down
    20,21,22,  20,22,23     // back
  ]);

  // Write vertex information to buffer objects
  if (!initArrayBuffer(gl, 'a_Position', vertices, gl.FLOAT, 3)) return -1;
  if (!initArrayBuffer(gl, 'a_Color', colors, gl.FLOAT, 4)) return -1;

  // Create an index buffer
  var indexBuffer = gl.createBuffer();
  if (!indexBuffer) {
    console.log('Failed to create the index buffer object');
    return -1;
  }

  // Write indices to the buffer object
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  return indices.length;
}

function initArrayBuffer(gl, attribute, data, type, num) {
  var buffer = gl.createBuffer();
  if (!buffer) {
    console.log('Failed to create buffer object for ' + attribute);
    return false;
  }
  
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  var a_attribute = gl.getAttribLocation(gl.program, attribute);
  if (a_attribute < 0) {
    console.log('Failed to get the storage location of ' + attribute);
    return false;
  }

  gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);
  gl.enableVertexAttribArray(a_attribute);

  return true;
}

function draw(gl, n, viewProjMatrix, u_ModelMatrix, u_MvpMatrix, 
             yAngle, xAngle, xOffset, zScale) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var modelMatrix = new Matrix4();
  var mvpMatrix = new Matrix4();

  // Cube 1: Top-right, y-axis rotation
  modelMatrix.setTranslate(0.8, 0.8, 0.0);
  modelMatrix.scale(0.8, 0.8, 0.8);  // Make cube slightly smaller
  modelMatrix.rotate(yAngle, 0.0, 1.0, 0.0);
  mvpMatrix.set(viewProjMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0);

  // Cube 2: Top-left, x-axis translation
  modelMatrix.setTranslate(-0.8 + xOffset, 0.8, 0.0);
  modelMatrix.scale(0.8, 0.8, 0.8);  // Make cube slightly smaller
  mvpMatrix.set(viewProjMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0);

  // Cube 3: Bottom-left, z-axis scaling
  modelMatrix.setTranslate(-0.8, -0.8, 0.0);
  modelMatrix.scale(0.8, 0.8, 0.8 * zScale);  // Scale with base size
  mvpMatrix.set(viewProjMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0);

  // Cube 4: Bottom-right, x-axis rotation
  modelMatrix.setTranslate(0.8, -0.8, 0.0);
  modelMatrix.scale(0.8, 0.8, 0.8);  // Make cube slightly smaller
  modelMatrix.rotate(xAngle, 1.0, 0.0, 0.0);
  mvpMatrix.set(viewProjMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0);
}