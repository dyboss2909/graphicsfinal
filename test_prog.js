// Vertex shader program
var VSHADER_SOURCE =
    'attribute vec4 a_Position;\n' +         // Position of the vertex
    'attribute vec4 a_Color;\n' +            // Color of the vertex
    'attribute vec4 a_Normal;\n' +           // Normal vector for lighting calculations
    'attribute vec2 a_TexCoord;\n' +         // Texture coordinates for texture mapping
    'uniform mat4 u_MvpMatrix;\n' +          // Model-View-Projection matrix for transforming vertices
    'uniform mat4 u_ModelMatrix;\n' +        // Model matrix for transforming the object
    'uniform mat4 u_NormalMatrix;\n' +       // Matrix for transforming normals
    'uniform vec3 u_LightColor;\n' +         // Color of the directional light
    'uniform vec3 u_LightDirection;\n' +     // Direction vector for directional light
    'uniform vec3 u_AmbientLight;\n' +       // Ambient light intensity
    'uniform vec3 u_PointLightPosition;\n' + // Position of the point light source
    'uniform bool u_UseTexture;\n' +         // Boolean flag to decide texture usage
    'varying vec2 v_TexCoord;\n' +           // Pass texture coordinates to fragment shader
    'varying vec4 v_Color;\n' +              // Pass calculated color to fragment shader
    'void main() {\n' +
    '  gl_Position = u_MvpMatrix * u_ModelMatrix * a_Position;\n' + // Transform vertex position to clip space
    '  vec3 normal = normalize(vec3(u_NormalMatrix * a_Normal));\n' + // Transform and normalize normal vector
    '  float nDotL = max(dot(u_LightDirection, normal), 0.0);\n' +    // Diffuse lighting (directional light)
    '  vec4 vertexPosition = u_ModelMatrix * a_Position;\n' +         // Calculate vertex position in world space
    '  vec3 pointLightDirection = normalize(u_PointLightPosition - vec3(vertexPosition));\n' + // Direction to the point light
    '  float pointNDotL = max(dot(pointLightDirection, normal), 0.0);\n' + // Diffuse lighting (point light)
    '  float distance = length(u_PointLightPosition - vec3(vertexPosition));\n' + // Calculate distance to point light
    '  float attenuation = 1.0 / (1.0 + 0.1 * distance + 0.01 * distance * distance);\n' + // Light attenuation formula
    '  vec3 diffuse = u_LightColor * a_Color.rgb * nDotL;\n' +        // Combine light color and vertex color (directional)
    '  vec3 pointDiffuse = u_LightColor * a_Color.rgb * pointNDotL * attenuation;\n' + // Combine light and vertex color (point)
    '  vec3 ambient = u_AmbientLight * a_Color.rgb;\n' +              // Calculate ambient light contribution
    '  v_Color = vec4(diffuse + pointDiffuse + ambient, a_Color.a);\n' + // Final vertex color with transparency
    '  v_TexCoord = a_TexCoord;\n' +                                  // Pass texture coordinates
    '}';



// Fragment shader program
var FSHADER_SOURCE =
    '#ifdef GL_ES\n' +
    'precision mediump float;\n' +       // Set precision for floats
    '#endif\n' +
    'uniform sampler2D u_Sampler;\n' +   // Sampler for textures
    'uniform bool u_UseTexture;\n' +     // Boolean to toggle texture use
    'varying vec2 v_TexCoord;\n' +       // Interpolated texture coordinates
    'varying vec4 v_Color;\n' +          // Interpolated vertex color
    'void main() {\n' +
    '  if (u_UseTexture) {\n' +          // If texture is enabled
    '    gl_FragColor = texture2D(u_Sampler, v_TexCoord);\n' + // Sample texture color
    '  } else {\n' +
    '    gl_FragColor = v_Color;\n' +    // Use interpolated vertex color
    '  }\n' +
    '}';



    // Update these camera variables at the top of your code
    var cameraPosition = {
        x: 3,
        y: 3,
        z: 7
    };

    var lookAtPoint = {
        x: 0,
        y: 0,
        z: 0
    };

    var zoomLevel = 1.0;
    const ANGLE_STEP = 0.8; // Reduced for smoother movement
    const ZOOM_STEP = 0.1;
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 2.0;

    const EYE_STEP = 0.5;  // How much to move the eye position each click
    const MIN_EYE_Y = 1;   // Minimum eye height
    const MAX_EYE_Y = 10;  // Maximum eye height

    const MOVE_STEP = 0.5;  // How much to move camera per click
const MIN_DISTANCE = 2; // Minimum distance from origin
const MAX_DISTANCE = 15; // Maximum distance from origin

// Global variables
var gl;
var canvas;
var mvpMatrix;
var modelMatrix;
var u_MvpMatrix;
var u_ModelMatrix;
var planeBuffer;
var a_Normal;

// Ring constants
var RING_RADIUS = 2.5;
var RING_THICKNESS = 0.2;
var RING_SEGMENTS = 50;

// Ball parameters
var ballPosition = { x: 0.0, y: 0.0, z: 0.0 }; // Initial position
var ballVelocity = { x: 0.01, y: 0.015, z: 0.02 }; // Random initial velocity
var ballRadius = 0.23; // Radius of the ball

var ballBuffer;
var cubeBuffer;

var roadBuffer;
var roadDashesBuffer;
var edgeLinesBuffer;

var skyTexture;
var skyBuffer;
var u_Sampler;
var u_UseTexture;
var a_TexCoord;

var lightUniforms;
var pointLightPosition = { x: 2.0, y: 2.0, z: 2.0 };
var pointLightAngle = 0;

var lightIntensity = 0.5; // Start at 50%
var baseAmbientLight = [0.3, 0.3, 0.3];  // Higher base ambient to keep things visible
var baseLightColor = [0.5, 0.5, 0.5];    // Higher base light level

var dashWidthFront; // Width of dash at the front
    var dashWidthBack; // Width of dash at the back (closer to the horizon)
    var dashHeight;    // Height of each dash
    var dashSpacing;  // Spacing between dashes
    var numDashes;      // Number of dashes


// Animation variables for independent rotations
var cubeRotation = {
    x: 0.0,
    y: 0.0,
    z: 0.0
};

var ring1Rotation = {
    x: 0.0,
    y: 0.0,
    z: 0.0
};

var ring2Rotation = {
    x: 0.0,
    y: 0.0,
    z: 0.0
};

// Rotation speeds (different for each component)
var ROTATION_SPEEDS = {
    cube: {
        x: 2.0,
        y: 1.5,
        z: 1.0
    },
    ring1: {
        x: 0.8,
        y: -1.0,
        z: 0.6
    },
    ring2: {
        x: -0.6,
        y: 0.8,
        z: -1.0
    }
};
const ASSEMBLY_SCALE = 0.35;
const ASSEMBLY_POSITION = {
    x: 0.5,
    y: 2.5,
    z: 0.0
};

// Add these variables at the top with other global variables
var isOrthographic = false;
var orthoScale = 10.0; // Controls the size of the orthographic view volume

function initControls() {
    document.getElementById('lookLeft').addEventListener('click', () => {
        lookAtPoint.x -= ANGLE_STEP;
    });

    document.getElementById('lookRight').addEventListener('click', () => {
        lookAtPoint.x += ANGLE_STEP;
    });

    document.getElementById('lookUp').addEventListener('click', () => {
        lookAtPoint.y += ANGLE_STEP;
    });

    document.getElementById('lookDown').addEventListener('click', () => {
        lookAtPoint.y -= ANGLE_STEP;
    });

    document.getElementById('eyeDown').addEventListener('click', () => {
        cameraPosition.y = Math.min(MAX_EYE_Y, cameraPosition.y + EYE_STEP);
    });

    document.getElementById('eyeUp').addEventListener('click', () => {
        cameraPosition.y = Math.max(MIN_EYE_Y, cameraPosition.y - EYE_STEP);
    });


    document.getElementById('lookReset').addEventListener('click', () => {
        lookAtPoint.x = 0;
        lookAtPoint.y = 0;
        lookAtPoint.z = 0;
        currentFOV = baseFOV;
        
    });

    // Zoom controls
    document.getElementById('zoomOut').addEventListener('click', () => {
        zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel - ZOOM_STEP));
    });

    document.getElementById('zoomIn').addEventListener('click', () => {
        zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP));
    });
    const lightSlider = document.getElementById('lightIntensity');
    lightSlider.addEventListener('input', function(e) {
        lightIntensity = e.target.value / 100; // Convert percentage to decimal
        updateLightIntensity(
            gl,
            lightUniforms.u_LightColor,
            lightUniforms.u_AmbientLight,
            lightIntensity
        );
    });

    // Add button for toggling projection
    document.getElementById('toggleProjection').addEventListener('click', () => {
        toggleProjection();
    });

    // Add controls for orthographic scale
    document.getElementById('orthoScaleUp').addEventListener('click', () => {
        orthoScale = Math.min(orthoScale + 1.0, 20.0);
    });

    document.getElementById('orthoScaleDown').addEventListener('click', () => {
        orthoScale = Math.max(orthoScale - 1.0, 5.0);
    });
}
function main() {
    // Retrieve <canvas> element
    canvas = document.getElementById('webgl');

    // Get WebGL context
    gl = getWebGLContext(canvas);
    if (!gl) {
        console.error('Failed to get WebGL context.');
        return;
    }

    // Initialize shaders
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.error('Failed to initialize shaders.');
        return;
    }

    // Initialize global matrices
    modelMatrix = new Matrix4();
    mvpMatrix = new Matrix4();

    // Get uniform and attribute locations
    a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    a_Color = gl.getAttribLocation(gl.program, 'a_Color');
    u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    u_MvpMatrix = gl.getUniformLocation(gl.program, 'u_MvpMatrix');
    a_TexCoord = gl.getAttribLocation(gl.program, 'a_TexCoord');
    u_UseTexture = gl.getUniformLocation(gl.program, 'u_UseTexture');
    u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');
    a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
    if (a_Position < 0 || a_Color < 0 || a_Normal < 0 || !u_ModelMatrix || !u_MvpMatrix) {
        console.error('Failed to get attribute or uniform locations.');
        return;
    }

    // Initialize buffers
    cubeBuffer = initVertexBuffers(gl); // Store cube buffers globally
    ringBuffers = initRingBuffers(gl); // Initialize ring buffers
    ballBuffer = initBallBuffer(gl);   // Initialize ball buffer
    planeBuffer = initPlaneBuffer(gl);
    roadBuffer = initRoadBuffer(gl);
    roadDashesBuffer = initRoadDashesBuffer(gl);
    edgeLinesBuffer = initEdgeLinesBuffer(gl);
    console.log('Initializing textures...');
    skyTexture = initTextures(gl);
    skyBuffer = initSkyBuffer(gl);
    lightUniforms = initLighting(gl);


    // Set clear color and enable depth test
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Initialize controls first
    initControls();

    // Start animation
    tick();
    
}

function initLighting(gl) {
    // Get the storage locations of lighting uniforms
    const u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
    const u_LightDirection = gl.getUniformLocation(gl.program, 'u_LightDirection');
    const u_AmbientLight = gl.getUniformLocation(gl.program, 'u_AmbientLight');
    const u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
    const u_PointLightPosition = gl.getUniformLocation(gl.program, 'u_PointLightPosition');

    if (!u_LightColor || !u_LightDirection || !u_AmbientLight || !u_NormalMatrix || !u_PointLightPosition) {
        console.log('Failed to get lighting uniform locations');
        return;
    }

    // Initialize with the default intensity
    updateLightIntensity(gl, u_LightColor, u_AmbientLight, lightIntensity);

    // Set light direction (normalized)
    const lightDirection = new Vector3([0.5, 3.0, 4.0]);
    lightDirection.normalize();
    gl.uniform3fv(u_LightDirection, lightDirection.elements);

    // Set point light position
    gl.uniform3f(u_PointLightPosition, 2.0, 2.0, 2.0);

    return {
        u_LightColor,
        u_LightDirection,
        u_AmbientLight,
        u_NormalMatrix,
        u_PointLightPosition
    };
}
// Update the light intensity function
function updateLightIntensity(gl, u_LightColor, u_AmbientLight, intensity) {
    // Calculate new light colors based on intensity, starting from a visible level
    const scaledLightColor = baseLightColor.map(x => Math.min(x * intensity + 0.3, 1.0));
    const scaledAmbientLight = baseAmbientLight.map(x => Math.min(x * intensity + 0.2, 1.0));
    
    // Update uniforms
    gl.uniform3f(u_LightColor, 
        scaledLightColor[0], 
        scaledLightColor[1], 
        scaledLightColor[2]
    );
    
    gl.uniform3f(u_AmbientLight,
        scaledAmbientLight[0],
        scaledAmbientLight[1],
        scaledAmbientLight[2]
    );
}

function updatePointLight() {
    pointLightAngle += 0.02;
    const radius = 3.0;
    pointLightPosition.x = Math.cos(pointLightAngle) * radius;
    pointLightPosition.y = 2.0 + Math.sin(pointLightAngle) * 0.5; // Slight up/down movement
    pointLightPosition.z = Math.sin(pointLightAngle) * radius;

    gl.uniform3f(lightUniforms.u_PointLightPosition, 
        pointLightPosition.x, 
        pointLightPosition.y, 
        pointLightPosition.z);
}


function initVertexBuffers(gl) {
    // Create cube vertices
    var cubeVertices = new Float32Array([
        // Front face
        1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
        // Right face
        1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0,
        // Up face
        1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0,
        // Left face
        -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0,
        // Down face
        -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
        // Back face
        1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0,
    ]);

 // Define cube colors with high transparency (glass-like)
var cubeColors = new Float32Array([
    1.0, 0.0, 0.0, 0.2,  // Red, more transparent
    1.0, 0.0, 0.0, 0.2,
    1.0, 0.0, 0.0, 0.2,
    1.0, 0.0, 0.0, 0.2,  // Front face

    0.0, 1.0, 0.0, 0.2,  // Green
    0.0, 1.0, 0.0, 0.2,
    0.0, 1.0, 0.0, 0.2,
    0.0, 1.0, 0.0, 0.2,  // Right face

    0.0, 0.0, 1.0, 0.2,  // Blue
    0.0, 0.0, 1.0, 0.2,
    0.0, 0.0, 1.0, 0.2,
    0.0, 0.0, 1.0, 0.2,  // Top face

    1.0, 1.0, 0.0, 0.2,  // Yellow
    1.0, 1.0, 0.0, 0.2,
    1.0, 1.0, 0.0, 0.2,
    1.0, 1.0, 0.0, 0.2,  // Left face

    1.0, 0.0, 1.0, 0.2,  // Magenta
    1.0, 0.0, 1.0, 0.2,
    1.0, 0.0, 1.0, 0.2,
    1.0, 0.0, 1.0, 0.2,  // Bottom face

    0.0, 1.0, 1.0, 0.2,  // Cyan
    0.0, 1.0, 1.0, 0.2,
    0.0, 1.0, 1.0, 0.2,
    0.0, 1.0, 1.0, 0.2   // Back face
]);

    var cubeIndices = new Uint8Array([
        0, 1, 2, 0, 2, 3,    // Front
        4, 5, 6, 4, 6, 7,    // Right
        8, 9, 10, 8, 10, 11, // Top
        12, 13, 14, 12, 14, 15, // Bottom
        16, 17, 18, 16, 18, 19, // Left
        20, 21, 22, 20, 22, 23, // Back
    ]);

    // Create and bind buffers for the cube
    var vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

    var colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeColors, gl.STATIC_DRAW);

    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);

    return { vertexBuffer, colorBuffer, indexBuffer, indexCount: cubeIndices.length };
}

function initPlaneBuffer(gl) {
    // Create a very large rectangular plane
    const vertices = new Float32Array([
        // Positions for a large rectangle stretching along the X and Z axes
        -100000.0, -20.0,  100000.0,  // Front left (closer to camera)
         100000.0, -20.0,  100000.0,  // Front right
         100000.0, -25.0, -100000.0,  // Back right (far away)
        -100000.0, -25.0, -100000.0   // Back left (far away)
    ]);

    // Gray color for the plane
    const colors = new Float32Array([
        0.25, 0.12, 0.0, 1.0,  // Darker brown
        0.25, 0.12, 0.0, 1.0,
        0.25, 0.12, 0.0, 1.0,
        0.25, 0.12, 0.0, 1.0
    ]);

    const indices = new Uint8Array([
        0, 1, 2,    // First triangle
        0, 2, 3     // Second triangle
    ]);

    // Create and bind vertex buffer
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Create and bind color buffer
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

    // Create and bind index buffer
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return {
        vertexBuffer,
        colorBuffer,
        indexBuffer,
        indexCount: indices.length
    };
}

function initSkyBuffer(gl) {
    // Create vertices and texture coordinates
    const vertices = new Float32Array([
        -1.0,  1.0,  0.999,  // v0
         1.0,  1.0,  0.999,  // v1
        -1.0, -1.0,  0.999,  // v2
         1.0, -1.0,  0.999   // v3
    ]);

    const texCoords = new Float32Array([
        0.0, 1.0,    // v0
        1.0, 1.0,    // v1
        0.0, 0.0,    // v2
        1.0, 0.0     // v3
    ]);

    const normals = new Float32Array([
        0.0, 0.0, 1.0,    // v0
        0.0, 0.0, 1.0,    // v1
        0.0, 0.0, 1.0,    // v2
        0.0, 0.0, 1.0     // v3
    ]);

    // Create and set up buffers
    const vertexBuffer = gl.createBuffer();
    const texCoordBuffer = gl.createBuffer();
    const normalBuffer = gl.createBuffer();

    // Buffer the vertex positions
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Buffer the texture coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    // Buffer the normals
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

    return {
        vertexBuffer: vertexBuffer,
        texCoordBuffer: texCoordBuffer,
        normalBuffer: normalBuffer,
        vertexCount: 4
    };
}
function initTextures(gl) {
  const texture = gl.createTexture();
  
  // Create a temporary black texture
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, 
                new Uint8Array([0, 0, 0, 255]));

  const image = new Image();
  image.onload = function() {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      
      // Upload the image
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      
      // Set texture parameters for proper scaling
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      
      texture.ready = true;
      console.log('Texture loaded successfully');
  };

  image.onerror = function() {
      console.error('Error loading texture image');
  };

  image.src = '../project/resources/night.jpg'; // Adjust path as needed
  
  return texture;
}

function initRoadBuffer(gl) {
    // Define vertices for a trapezoidal road
    const vertices = new Float32Array([
        // Wider front part of the road
        -20.0, -20.0,  100.0,  // Front left
         20.0, -20.0,  100.0,  // Front right

        // Narrower back part of the road (closer to the horizon)
         -5.0, -22.0, -100.0,  // Back left
          5.0, -22.0, -100.0   // Back right
    ]);

    // Black color for the road
    const colors = new Float32Array([
        0.0, 0.0, 0.0, 1.0,  // Black
        0.0, 0.0, 0.0, 1.0,
        0.0, 0.0, 0.0, 1.0,
        0.0, 0.0, 0.0, 1.0
    ]);

    const indices = new Uint8Array([
        0, 1, 2,    // First triangle
        1, 2, 3     // Second triangle
    ]);

    // Create and bind vertex buffer
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Create and bind color buffer
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

    // Create and bind index buffer
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return {
        vertexBuffer,
        colorBuffer,
        indexBuffer,
        indexCount: indices.length
    };
}

function initRoadDashesBuffer(gl) {
    // Define vertices for the dashed white lines along the road
    const vertices = [];
    const colors = [];
    const indices = [];

    const dashWidthFront = 2.0; // Width of dash at the front
    const dashWidthBack = 0.5; // Width of dash at the back (closer to the horizon)
    const dashHeight = 5.0;    // Height of each dash
    const dashSpacing = 10.0;  // Spacing between dashes
    const roadFrontZ = 100.0;  // Front z-coordinate of the road
    const roadBackZ = -100.0;  // Back z-coordinate of the road

    var zFront = roadFrontZ;   // Start at the front of the road
    while (zFront - dashHeight > roadBackZ) {
        const zBack = zFront - dashHeight; // Back z position of the dash

        // Calculate width scaling for perspective effect
        const widthFront = dashWidthFront - ((roadFrontZ - zFront) * (dashWidthFront - dashWidthBack) / (roadFrontZ - roadBackZ));
        const widthBack = dashWidthFront - ((roadFrontZ - zBack) * (dashWidthFront - dashWidthBack) / (roadFrontZ - roadBackZ));

        // Add vertices for the current dash
        const baseIndex = vertices.length / 3;

        vertices.push(
            -widthFront / 2, -19.9, zFront,  // Front left
             widthFront / 2, -19.9, zFront,  // Front right
            -widthBack / 2,  -19.9, zBack,   // Back left
             widthBack / 2,  -19.9, zBack    // Back right
        );

        // Add white color for the dash
        for (var j = 0; j < 4; j++) {
            colors.push(1.0, 1.0, 1.0, 1.0); // White color
        }

        // Add indices for the dash
        indices.push(
            baseIndex, baseIndex + 1, baseIndex + 2,  // First triangle
            baseIndex + 1, baseIndex + 2, baseIndex + 3   // Second triangle
        );

        // Move to the next dash position
        zFront = zBack - dashSpacing;
    }

    // Create and bind vertex buffer
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    // Create and bind color buffer
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    // Create and bind index buffer
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(indices), gl.STATIC_DRAW);

    return {
        vertexBuffer,
        colorBuffer,
        indexBuffer,
        indexCount: indices.length
    };
}



function initEdgeLinesBuffer(gl) {
    const vertices = [
        // Left edge line
        -21.5, -20.0,  125.0,  // Front left
        -4.0,  -20.0, -85.0,  // Back left

        // Right edge line
         22.5, -20.0,  140.0,  // Front right
          4.0,  -20.0, -90.0  // Back right
    ];

    const colors = [
        1.0, 1.0, 1.0, 1.0,  // White color for left front
        1.0, 1.0, 1.0, 1.0,  // White color for left back
        1.0, 1.0, 1.0, 1.0,  // White color for right front
        1.0, 1.0, 1.0, 1.0   // White color for right back
    ];

    const indices = [
        0, 1,  // Left edge line
        2, 3   // Right edge line
    ];

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return {
        vertexBuffer,
        colorBuffer,
        indexBuffer,
        indexCount: indices.length
    };
}


function initBallBuffer(gl) {
    var ballSegments = 30;
    var ballVertices = [];
    var ballIndices = [];
    var ballColors = [];  // Add this for colors

    for (var lat = 0; lat <= ballSegments; lat++) {
        var theta = (lat * Math.PI) / ballSegments;
        var sinTheta = Math.sin(theta);
        var cosTheta = Math.cos(theta);

        for (var lon = 0; lon <= ballSegments; lon++) {
            var phi = (lon * 2 * Math.PI) / ballSegments;
            var sinPhi = Math.sin(phi);
            var cosPhi = Math.cos(phi);

            var x = cosPhi * sinTheta;
            var y = cosTheta;
            var z = sinPhi * sinTheta;

            ballVertices.push(x * ballRadius, y * ballRadius, z * ballRadius);
            // Add red color with full opacity for each vertex
            ballColors.push(1.0, 0.2, 0.2, 1.0);
        }
    }

    for (var lat = 0; lat < ballSegments; lat++) {
        for (var lon = 0; lon < ballSegments; lon++) {
            var first = lat * (ballSegments + 1) + lon;
            var second = first + ballSegments + 1;

            ballIndices.push(first, second, first + 1);
            ballIndices.push(second, second + 1, first + 1);
        }
    }

    var vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ballVertices), gl.STATIC_DRAW);

    var colorBuffer = gl.createBuffer();  // Add this
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);  // Add this
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ballColors), gl.STATIC_DRAW);  // Add this

    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ballIndices), gl.STATIC_DRAW);

    return {
        vertexBuffer,
        colorBuffer,  // Add this
        indexBuffer,
        indexCount: ballIndices.length
    };
}

function updateBallPosition() {
    // Apply gravity
    ballVelocity.y -= 0.001;

    // Define strict boundaries (now relative to cube size of 1.0)
    const maxBound = 0.55 - ballRadius;
    const dampening = 0.95;

    // Update and check each axis separately
    ballPosition.x += ballVelocity.x;
    if (Math.abs(ballPosition.x) > maxBound) {
        ballPosition.x = Math.sign(ballPosition.x) * maxBound;
        ballVelocity.x = -ballVelocity.x * dampening;
        ballVelocity.y += (Math.random() - 0.5) * 0.02;
        ballVelocity.z += (Math.random() - 0.5) * 0.02;
    }

    ballPosition.y += ballVelocity.y;
    if (Math.abs(ballPosition.y) > maxBound) {
        ballPosition.y = Math.sign(ballPosition.y) * maxBound;
        ballVelocity.y = -ballVelocity.y * dampening;
        ballVelocity.x += (Math.random() - 0.5) * 0.02;
        ballVelocity.z += (Math.random() - 0.5) * 0.02;
    }

    ballPosition.z += ballVelocity.z;
    if (Math.abs(ballPosition.z) > maxBound) {
        ballPosition.z = Math.sign(ballPosition.z) * maxBound;
        ballVelocity.z = -ballVelocity.z * dampening;
        ballVelocity.x += (Math.random() - 0.5) * 0.02;
        ballVelocity.y += (Math.random() - 0.5) * 0.02;
    }

    // Speed control
    const maxSpeed = 0.08;
    const minSpeed = 0.04;

    // Ensure minimum velocity
    if (Math.abs(ballVelocity.x) < minSpeed) {
        ballVelocity.x = Math.sign(ballVelocity.x || 1) * minSpeed;
    }
    if (Math.abs(ballVelocity.z) < minSpeed) {
        ballVelocity.z = Math.sign(ballVelocity.z || 1) * minSpeed;
    }

    // Clamp velocities
    ballVelocity.x = Math.max(Math.min(ballVelocity.x, maxSpeed), -maxSpeed);
    ballVelocity.y = Math.max(Math.min(ballVelocity.y, maxSpeed), -maxSpeed);
    ballVelocity.z = Math.max(Math.min(ballVelocity.z, maxSpeed), -maxSpeed);
}

function initRingBuffers(gl) {
    // Create ring data for both XZ and YZ planes
    const ringXZData = createRingVertices(RING_RADIUS, RING_THICKNESS, RING_SEGMENTS);
    const ringYZData = createRingVertices(RING_RADIUS, RING_THICKNESS, RING_SEGMENTS);
    
    // Rotate YZ ring vertices to correct plane
    for (var i = 0; i < ringYZData.vertices.length; i += 3) {
        const x = ringYZData.vertices[i];
        const y = ringYZData.vertices[i + 1];
        const z = ringYZData.vertices[i + 2];
        ringYZData.vertices[i] = z;     // x = old z
        ringYZData.vertices[i + 1] = x; // y = old x
        ringYZData.vertices[i + 2] = y; // z = old y
    }

    // Create and initialize buffers for XZ ring
    const xzVertexBuffer = gl.createBuffer();
    const xzColorBuffer = gl.createBuffer();
    const xzIndexBuffer = gl.createBuffer();
    
    gl.bindBuffer(gl.ARRAY_BUFFER, xzVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, ringXZData.vertices, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, xzColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, ringXZData.colors, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, xzIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ringXZData.indices, gl.STATIC_DRAW);

    // Create and initialize buffers for YZ ring
    const yzVertexBuffer = gl.createBuffer();
    const yzColorBuffer = gl.createBuffer();
    const yzIndexBuffer = gl.createBuffer();
    
    gl.bindBuffer(gl.ARRAY_BUFFER, yzVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, ringYZData.vertices, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, yzColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, ringYZData.colors, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, yzIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ringYZData.indices, gl.STATIC_DRAW);

    return {
        ringXZ: {
            vertexBuffer: xzVertexBuffer,
            colorBuffer: xzColorBuffer,
            indexBuffer: xzIndexBuffer,
            indexCount: ringXZData.indices.length
        },
        ringYZ: {
            vertexBuffer: yzVertexBuffer,
            colorBuffer: yzColorBuffer,
            indexBuffer: yzIndexBuffer,
            indexCount: ringYZData.indices.length
        }
    };
}
function createRingVertices(radius, thickness, segments) {
    const vertices = [];
    const indices = [];
    const colors = [];
    
    // Create vertices for a complete ring
    for (var i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        
        // Outer vertex
        vertices.push(
            cosTheta * (radius + thickness), 
            0,
            sinTheta * (radius + thickness)
        );
        colors.push(1.0, 1.0, 1.0, 1.0);  // White color
        
        // Inner vertex
        vertices.push(
            cosTheta * (radius - thickness),
            0,
            sinTheta * (radius - thickness)
        );
        colors.push(1.0, 1.0, 1.0, 1.0);  // White color
    }
    
    // Create indices for triangle strip
    for (var i = 0; i < segments * 2; i++) {
        indices.push(i);
    }
    // Close the ring
    indices.push(0);
    indices.push(1);
    
    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices),
        colors: new Float32Array(colors)
    };
}


function createRingIndices(startIndex, vertexCount) {
    var indices = [];
    for (var i = 0; i < vertexCount - 2; i += 2) {
        indices.push(
            startIndex + i, startIndex + i + 1, startIndex + i + 2,
            startIndex + i + 1, startIndex + i + 3, startIndex + i + 2
        );
    }
    return new Uint8Array(indices);
}

function initArrayBuffer(gl, data, num, type, attribute) {
    if (!data || data.length === 0) {
        console.log(`Error: Data for attribute ${attribute} is undefined or empty.`);
        return false;
    }

    var buffer = gl.createBuffer();
    if (!buffer) {
        console.log('Failed to create the buffer object');
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

function tick() {
    updateBallPosition(); // Update ball position
    animate(); // Update cube and rings
    updatePointLight();
    draw(); // Render the scene
    requestAnimationFrame(tick);
}

function animate() {
    // Update cube rotation
    cubeRotation.x = (cubeRotation.x + ROTATION_SPEEDS.cube.x) % 360;
    cubeRotation.y = (cubeRotation.y + ROTATION_SPEEDS.cube.y) % 360;
    cubeRotation.z = (cubeRotation.z + ROTATION_SPEEDS.cube.z) % 360;
    
     // Update ring1 rotation
     ring1Rotation.x = (ring1Rotation.x + ROTATION_SPEEDS.ring1.x) % 360;
     ring1Rotation.y = (ring1Rotation.y + ROTATION_SPEEDS.ring1.y) % 360;
     ring1Rotation.z = (ring1Rotation.z + ROTATION_SPEEDS.ring1.z) % 360;
 
     // Update ring2 rotation
     ring2Rotation.x = (ring2Rotation.x + ROTATION_SPEEDS.ring2.x) % 360;
     ring2Rotation.y = (ring2Rotation.y + ROTATION_SPEEDS.ring2.y) % 360;
     ring2Rotation.z = (ring2Rotation.z + ROTATION_SPEEDS.ring2.z) % 360;
 
}

function drawPlane() {
    gl.bindBuffer(gl.ARRAY_BUFFER, planeBuffer.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, planeBuffer.colorBuffer);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planeBuffer.indexBuffer);

    modelMatrix.setIdentity();
    var mvpMatrix2 = new Matrix4(mvpMatrix);
    mvpMatrix2.multiply(modelMatrix);
    
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix2.elements);
    
    gl.drawElements(gl.TRIANGLES, planeBuffer.indexCount, gl.UNSIGNED_BYTE, 0);
}

function drawBall() {
    gl.bindBuffer(gl.ARRAY_BUFFER, ballBuffer.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, ballBuffer.colorBuffer);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ballBuffer.indexBuffer);

    modelMatrix.setIdentity();
    modelMatrix.translate(2.0, 2.0, 0.0); // Move to top-right
    modelMatrix.scale(0.5, 0.5, 0.5); // Scale down
    modelMatrix.translate(ballPosition.x, ballPosition.y, ballPosition.z); // Ball position

    const mvpMatrix2 = new Matrix4(mvpMatrix);
    mvpMatrix2.multiply(modelMatrix);

    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix2.elements);

    gl.drawElements(gl.TRIANGLES, ballBuffer.indexCount, gl.UNSIGNED_SHORT, 0);
}


function drawRoad() {
    gl.bindBuffer(gl.ARRAY_BUFFER, roadBuffer.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, roadBuffer.colorBuffer);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, roadBuffer.indexBuffer);

    modelMatrix.setIdentity();
    var mvpMatrix2 = new Matrix4(mvpMatrix);
    mvpMatrix2.multiply(modelMatrix);

    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix2.elements);

    gl.drawElements(gl.TRIANGLES, roadBuffer.indexCount, gl.UNSIGNED_BYTE, 0);
}

function drawDashes() {
    gl.bindBuffer(gl.ARRAY_BUFFER, roadDashesBuffer.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, roadDashesBuffer.colorBuffer);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, roadDashesBuffer.indexBuffer);

    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
    gl.drawElements(gl.TRIANGLES, roadDashesBuffer.indexCount, gl.UNSIGNED_BYTE, 0);
}

function drawEdgeLines() {
    gl.bindBuffer(gl.ARRAY_BUFFER, edgeLinesBuffer.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, edgeLinesBuffer.colorBuffer);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeLinesBuffer.indexBuffer);

    modelMatrix.setIdentity();
    const mvpMatrix2 = new Matrix4(mvpMatrix);
    mvpMatrix2.multiply(modelMatrix);

    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix2.elements);
    gl.drawElements(gl.LINES, edgeLinesBuffer.indexCount, gl.UNSIGNED_SHORT, 0);
}

/*function drawCube() {
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer.colorBuffer);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeBuffer.indexBuffer);

    modelMatrix.setIdentity();
    modelMatrix.translate(2.0, 2.0, 0.0); // Move to top-right
    modelMatrix.scale(0.5, 0.5, 0.5); // Scale down
    modelMatrix.rotate(cubeRotation.x, 1, 0, 0);
    modelMatrix.rotate(cubeRotation.y, 0, 1, 0);
    modelMatrix.rotate(cubeRotation.z, 0, 0, 1);

    const mvpMatrix2 = new Matrix4(mvpMatrix);
    mvpMatrix2.multiply(modelMatrix);

    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix2.elements);

    gl.drawElements(gl.TRIANGLES, cubeBuffer.indexCount, gl.UNSIGNED_BYTE, 0);
}






function drawRings() {
    const ringTranslation = new Matrix4();
    ringTranslation.setIdentity();
    ringTranslation.translate(2.0, 2.0, 0.0); // Move to top-right
    ringTranslation.scale(0.5, 0.5, 0.5); // Scale down

    // Ring 1 (XZ plane)
    gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffers.ringXZ.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffers.ringXZ.colorBuffer);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ringBuffers.ringXZ.indexBuffer);

    modelMatrix.set(ringTranslation); // Apply scaling and translation
    modelMatrix.rotate(ring1Rotation.x, 1, 0, 0);
    modelMatrix.rotate(ring1Rotation.y, 0, 1, 0);
    modelMatrix.rotate(ring1Rotation.z, 0, 0, 1);

    const mvpMatrix2 = new Matrix4(mvpMatrix);
    mvpMatrix2.multiply(modelMatrix);

    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix2.elements);

    gl.drawElements(gl.TRIANGLE_STRIP, ringBuffers.ringXZ.indexCount, gl.UNSIGNED_SHORT, 0);

    // Ring 2 (YZ plane)
    gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffers.ringYZ.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffers.ringYZ.colorBuffer);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ringBuffers.ringYZ.indexBuffer);

    modelMatrix.set(ringTranslation); // Apply scaling and translation
    modelMatrix.rotate(ring2Rotation.x, 1, 0, 0);
    modelMatrix.rotate(ring2Rotation.y, 0, 1, 0);
    modelMatrix.rotate(ring2Rotation.z, 0, 0, 1);

    mvpMatrix2.set(mvpMatrix);
    mvpMatrix2.multiply(modelMatrix);

    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix2.elements);

    gl.drawElements(gl.TRIANGLE_STRIP, ringBuffers.ringYZ.indexCount, gl.UNSIGNED_SHORT, 0);
} */


function drawAssembly() {
    // Save the original MVP matrix
    const originalMvpMatrix = new Matrix4(mvpMatrix);

    // Create assembly transformation matrix
    const assemblyMatrix = new Matrix4();
    assemblyMatrix.setIdentity();
    assemblyMatrix.translate(ASSEMBLY_POSITION.x, ASSEMBLY_POSITION.y, ASSEMBLY_POSITION.z);
    assemblyMatrix.scale(ASSEMBLY_SCALE, ASSEMBLY_SCALE, ASSEMBLY_SCALE);

    // Update MVP matrix with assembly transformation
    mvpMatrix.multiply(assemblyMatrix);

    const normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(modelMatrix);
    normalMatrix.transpose();
    gl.uniformMatrix4fv(lightUniforms.u_NormalMatrix, false, normalMatrix.elements);

    // Draw ball first (it's opaque)
    gl.bindBuffer(gl.ARRAY_BUFFER, ballBuffer.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, ballBuffer.colorBuffer);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ballBuffer.indexBuffer);

    modelMatrix.setIdentity();
    modelMatrix.translate(ballPosition.x, ballPosition.y, ballPosition.z);

    const mvpMatrix2 = new Matrix4(mvpMatrix);
    mvpMatrix2.multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix2.elements);

    gl.drawElements(gl.TRIANGLES, ballBuffer.indexCount, gl.UNSIGNED_SHORT, 0);

    // Draw transparent objects
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    // Draw cube
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer.colorBuffer);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeBuffer.indexBuffer);

    modelMatrix.setIdentity();
    modelMatrix.rotate(cubeRotation.x, 1, 0, 0);
    modelMatrix.rotate(cubeRotation.y, 0, 1, 0);
    modelMatrix.rotate(cubeRotation.z, 0, 0, 1);

    mvpMatrix2.set(mvpMatrix);
    mvpMatrix2.multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix2.elements);

    gl.drawElements(gl.TRIANGLES, cubeBuffer.indexCount, gl.UNSIGNED_BYTE, 0);

    // Draw rings
    // Ring 1 (XZ plane)
    gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffers.ringXZ.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffers.ringXZ.colorBuffer);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ringBuffers.ringXZ.indexBuffer);

    modelMatrix.setIdentity();
    modelMatrix.rotate(ring1Rotation.x, 1, 0, 0);
    modelMatrix.rotate(ring1Rotation.y, 0, 1, 0);
    modelMatrix.rotate(ring1Rotation.z, 0, 0, 1);

    mvpMatrix2.set(mvpMatrix);
    mvpMatrix2.multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix2.elements);

    gl.drawElements(gl.TRIANGLE_STRIP, ringBuffers.ringXZ.indexCount, gl.UNSIGNED_SHORT, 0);

    // Ring 2 (YZ plane)
    gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffers.ringYZ.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffers.ringYZ.colorBuffer);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ringBuffers.ringYZ.indexBuffer);

    modelMatrix.setIdentity();
    modelMatrix.rotate(90, 1, 0, 0); // Orient to YZ plane
    modelMatrix.rotate(ring2Rotation.x, 1, 0, 0);
    modelMatrix.rotate(ring2Rotation.y, 0, 1, 0);
    modelMatrix.rotate(ring2Rotation.z, 0, 0, 1);

    mvpMatrix2.set(mvpMatrix);
    mvpMatrix2.multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix2.elements);

    gl.drawElements(gl.TRIANGLE_STRIP, ringBuffers.ringYZ.indexCount, gl.UNSIGNED_SHORT, 0);

    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // Restore original MVP matrix
    mvpMatrix.set(originalMvpMatrix);
}



function drawSky() {
    if (!skyTexture || !skyTexture.ready) return;

    // Save current GL state
    const currentDepthTest = gl.isEnabled(gl.DEPTH_TEST);
    const currentBlend = gl.isEnabled(gl.BLEND);
    
    // Disable depth test and blending for sky
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    
    gl.uniform1i(u_UseTexture, true);
    
    // Set vertex positions
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    
    // Set texture coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer.texCoordBuffer);
    gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_TexCoord);

    // Set normals
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer.normalBuffer);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);
    
    // Bind texture and set up matrices as before
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, skyTexture);
    gl.uniform1i(u_Sampler, 0);
    
    modelMatrix.setIdentity();
    const mvpMatrix2 = new Matrix4();
    mvpMatrix2.setIdentity();
    
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix2.elements);
    
    // Draw the sky
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, skyBuffer.vertexCount);
    
    // Restore previous GL state
    if (currentDepthTest) gl.enable(gl.DEPTH_TEST);
    if (currentBlend) gl.enable(gl.BLEND);
    gl.uniform1i(u_UseTexture, false);
}
function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Draw sky first (will cover entire canvas)
    drawSky();

    // Set up camera for 3D scene
    if (isOrthographic) {
        // Orthographic projection
        // Parameters: (left, right, bottom, top, near, far)
        const aspect = canvas.width / canvas.height;
        const width = orthoScale * aspect;
        const height = orthoScale;
        mvpMatrix.setOrtho(
            -width/2, width/2,    // left, right
            -height/2, height/2,  // bottom, top
            1, 100                // near, far
        );
    } else {
        // Perspective projection (existing code)
        mvpMatrix.setPerspective(50, canvas.width / canvas.height, 1, 100);
    }

    mvpMatrix.lookAt(
        cameraPosition.x * zoomLevel, 
        cameraPosition.y * zoomLevel, 
        cameraPosition.z * zoomLevel,
        lookAtPoint.x, lookAtPoint.y, lookAtPoint.z,
        0, 1, 0
    );

    // Draw rest of the scene
    drawPlane();
    drawRoad();
    drawEdgeLines();
    drawDashes();
    

    // Draw transparent objects
    drawAssembly();

    //gl.depthMask(true);
    //gl.disable(gl.BLEND);
}

// Add a function to toggle between projection types
function toggleProjection() {
    isOrthographic = !isOrthographic;
}