/*
TITLE: Ghish
AUTHOR: Andrew Smith (Copyright 2024)
UPDATED: 5/11/2025
NOTES:
- 4/13/2024, v1.0.0: Initial release
- 4/18/2024, v1.0.1: Added info screen 
- 5/11/2025, v1.0.2: Improved mobile compatibility
*/

// System variables 
var isMobile = false; // whether browser is on mobile device -> used to change touch detection and rotate screen orientation
var fpsr = 2.0 ; // FPS ratio -> ratio of desktop FPS to current FPS, scalar applied to motion 

// Create boids array
const max_boid_pop = 100; // set limit on population of boids
let boids = [];           // create empty boids array

// Create barrier array
const max_barrier_pop = 20; // limit on number of barrier pieces to create
let barriers = []; 

// Define constants for each boid
let bw, bh;                 // size (width, height) based on screen dimensions
const bw_area_ratio = 0.04; // ratio of width to minimum screen width or height
const bwh_ratio = 1.8;      // aspect ratio of boids (bh / bw)

// Define constants for each barrier
let br_d;               // diameter of each barrier
var br_b_ratio = 4.0; // ratio of barrier diameter to boid width 

// Iso movement constants for boids
var max_vel = 2.0;     // maximum target velocity in pixels/sec (desired speed, true vel may exceed this due to barriers/shark)
var abs_max_vel = 5.0; // actual maximum velocity -> threshold for boid movement
var pnvs   = 0.10; // velocity (v.x, v.y) step size for perlin noise function
var vr_scl = 0.03; // magnitude of noise (+/-) for velocity
var dv_acc = 0.01; // acceleration magnitude to encourage set speed (max speed)

// Wall and barrier parameters   
var w_acc = 0.60;         // maximum magnitude of acceleration to avoid walls
var ba_acc = 0.10;        // " " barriers
var min_w_acc = 0.05;     // minimum magnitude of acceleration -> prevents "wall riding"
var g_acc = 0.2;          // if boid is "out of water" push down with higher acceleration
var wall_dist = 0.040;    // distance from wall to activate wall avoidance (as percent of screen width)
var barr_dist = 1.4;      // " " barrier avoidance distance (as percent of barrier diameter)
const barr_predict = 20;    // number of frames to predict boid position for barrier avoidance (allows smoother movement)
var acc_wall_pwr = 10;    // power law value for distance scaling near wall

// Shark parameters
var shrk_acc = 0.25;      // maximum magnitude of acceleration to avoid shark
var shrk_dist = 1.0;      // shark avoidance distance (as percent of barrier diameter)
const shrk_eat_dist = 0.16; // distance from shark center to eat boids (as percent of shark repulsion region diameter)

// Flocking mechanics parameters
let dist_s, dist_a, dist_c; // radius of region around boid for flocking behaviors (seperation, alignment, cohesion)
var scl_s = 0.001;        // scaling acceleration for seperation
var scl_a = 0.02;         // " " alignment
var scl_c = 0.0002;       // " " cohesion

// Wave generation mechanics
var num_segments = 200;  // segments of wave lines to use
const wave_amp = 0.10;     // vertical height of noise (as percent of screen height)
const wave_ht = 0.2;       // maximum height of the waves (as percent of screen height, used for collision detection and GUI)
const wave_ns = 0.002;     // scalar value of the noise function
const wave_bkgd_dy = 0.01; // vertical shift in averge value of background wave (allows for 2.5D perspective)
let wave_pos = [];         // vertical position of each wave point
let wave_pos_2 = [];       // " " background wave

// Option settings
var buoy_pos = [[0.74, 0], [0.79, 0], [0.85, 0], [0.90, 0], [0.96, 0]]; // (x,y) position of each option buoy (as percentage of screen width, x, or absolute, y)
var buoy_dia = 0.04;          // diameter of option buoy (percentage of screen width)
var buoy_dy = buoy_dia * 0.2; // vertical offset of buoy above surface position
let mouseClick = false;         // boolean variable to determine whether mouse button has been pressed
let game_option = 4;            // object placement mode -> 0 = boid, 1 = barrier, 2 = shark, 3 = reset, 4 = info
let prev_option = 0;            // previous game option to -> mode to return to after resuming (exiting info screen)
let pauseGame = false;          // stops boid movement for information screen

// Info screen
let info_text_img, info_text_bkgd_img; // images for info screen display

// Graphical display
const bkgd_color = '#2C2C2C';     // background color -> sky blue = '#354e63', dark grey = '#2C2C2B'
const fg_wave_color = '#FFFFFF';  // foreground wave color (white)
const bg_wave_color = '#AAAAAA';  // background wave color (light grey)
const sky_bkgd_color = '#DDDDDD'; // sky background pattern color (grey)
const buoy_color = '#521724';     // options buoy color (dark red)
const info_color = '#696969';     // color to display info screen panel
const bkgd_blur = '#000000BB';    // darken screen for info text display
const info_txt_color = '#000000'; // text color for info screen



function preload() {
  // Load images for info screen
  info_text_img = loadImage('assets/info_screen.png');           // preload both images 
  info_text_bkgd_img = loadImage('assets/info_screen_bkgd.png'); // " "
}
function setup() {
  w = windowWidth;  // window dimensions
  h = windowHeight; // " "

  checkMobile();    // determine browser type

  createCanvas(w, h);
  
  set_scale();

  // Initiate wave animation
  for(let i = 0; i < num_segments; i++) {
    append(wave_pos, 0); // add intial vertical position of wave segments
  }
  wave_pos_2 = [...wave_pos]; // copy array to background wave positions
 
}
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  w = windowWidth; h = windowHeight; // reset window dimensions

  checkMobile();    // determine browser type

  // Delete all objects
  boids = [];    // clear array
  barriers = []; // " "

  set_scale();
}
function checkMobile() {
  // Determines whether browser is a mobile device. 
  // https://www.geeksforgeeks.org/how-to-detect-whether-the-website-is-being-opened-in-a-mobile-device-or-a-desktop-in-javascript/
  
  /*
  let details = navigator.userAgent; // storing user's device details in a variable
  let regexp = /android|iphone|kindle|ipad/i; // creating a regular expression containing some mobile devices keywords to search it in details string
  let isMobileDevice = regexp.test(details); // using test() method to search regexp in details it returns boolean value
  */

  // set mobile setting
  if (h > w) { 
    isMobile = true; 
  } else { 
    isMobile = false; 
  }
}
function set_scale(){
  // Scale all objects

  // Define boid size
  bw = min(w,h) * bw_area_ratio; // overall size based on screen area
  bh = bw * bwh_ratio;      // height based on aspect ratio

  // Define barrier size
  br_d = br_b_ratio * bw; // barrier size based on boid size

  // Set proximity conditions for flocking
  dist_s = bh * 1.4;
  dist_a = bh * 5.0; 
  dist_c = bh * 8.0;

  // Rescale all size, position, speed, and accelerations for mobile mode
  pixelDensity(1); 
  if(isMobile){
    frameRate(30); // ratio of mobile FPS to desktop FPS is ~2.0 -> motion scaled accordinly
    fpsr = 2.0

    bw = min(w,h) * bw_area_ratio * 0.8; // make boids slightly smaller
    br_b_ratio = 3.0; // same as above for barriers

    buoy_dia = 0.04*3; // make buoys larger
    buoy_pos = [[0.30, 0], [0.45, 0], [0.60, 0], [0.75, 0], [0.90, 0]]; // increase spacing

    num_segments = 100; // decrease sky resolution
/*  
    max_vel = 2.0 * displayDensity();     
    abs_max_vel = 5.0 * displayDensity();

    buoy_pos = [[0.30, 0], [0.45, 0], [0.60, 0], [0.75, 0], [0.90, 0]];
    buoy_dia = 0.04 * displayDensity();
    buoy_dy = buoy_dia * 0.2;
    num_segments = 100;

    pnvs *= displayDensity;
    vr_scl *= displayDensity;
    dv_acc *= displayDensity;

    w_acc *= displayDensity;
    ba_acc *= displayDensity;
    min_w_acc *= displayDensity;
    g_acc *= displayDensity;
    wall_dist *= displayDensity;
    acc_wall_pwr *= displayDensity;

    shrk_acc *= displayDensity;
    shrk_dist *= displayDensity;

    scl_s *= displayDensity;
    scl_a *= displayDensity;
    scl_c *= displayDensity;
*/
  } else {
    frameRate(60);
    fpsr = 1.0;
  }
}



function draw() {
  //background('#354e63'); // navy blue background
  background(bkgd_color); // grey  

  click();   // process all mouse/touch actions

  waves();   // create wave animations and render background colors (sky and ocean)
  sky();     // sky background texture
  //title(); // display game title
  options(); // displays option buoys and allows user selection
  ocean();   // ocean background color
  reset();   // resets all objects if buoy is selected
  
  // Animate all boids
  for(let i = 0; i < boids.length; i++) {
    if( !pauseGame ) {   // prevent movement options during pause events (info screen display)
      boids[i].flock();  // group movement
      boids[i].iso();    // individual movement
      boids[i].walls();  // avoid wall barriers
      boids[i].move();   // update position
    }
    boids[i].display();  // show individual boid
    //boids[i].debug();  // display debugging tools
  } 

  // Compute all barriers
  for(let i = 0; i < barriers.length; i++) {
    barriers[i].display(); // show on screen
  } 

  if( game_option == 4 ) {
    pauseGame = true;  // pause game
    info();            // display information screen
  } else {
    pauseGame = false; // unpause game
  }

  remove_boid();   // deletes boids if they are out-of-bounds or eaten by shark 

  //fill(255); noStroke(); textSize(20); text("test2", w/2, h/2);

  mouseClick = false; // reset mouse boolean at end of frame

  let sz = w/100; 
  fill(255); textSize(sz);
  text(w, w/2, h/2);
  text(h, w/2, h/2 + sz);
  text(round(frameRate(),0), w/2, h/2+2*sz);

}



function waves () {
  // Display ocean wave movement and sky texture

  let wave_offset = (wave_ht - wave_amp) * h; // vertical offset of waves based on predfined max wave height and amplitude

  for(let i=0; i<num_segments; i++){
    // Define wave position
    let dx = w / (num_segments-1); // width of each segment (allow room for rightmost segment)
    let x1 = i*dx;
    let x2 = (i+1)*dx; 
    let y1_1 = wave_pos[i]; 
    let y2_1 = wave_pos[i+1];

    // Repeat for background wave
    let y1_2 = wave_pos_2[i]; 
    let y2_2 = wave_pos_2[i+1];
    
    // Calculate new position values
    let nx = wave_ns * x1;
    let nt = wave_ns * frameCount; 
    let new_y_1 = (wave_amp * h) * noise(nx, nt);     // foreground wave
    let new_y_2 = (wave_amp * h) * noise(nx + w, nt); // background wave
    wave_pos[i] = new_y_1 + wave_offset;              // set new position for foreground wave
    wave_pos_2[i] = new_y_2 + wave_offset - h*0.01;            // " " background wave

    // Draw all wave segments & sky background
    if (wave_pos[i] >= wave_pos_2[i] ) {
      // Background wave
      stroke(bg_wave_color); strokeWeight(1.5);
      line(x1, y1_2, x2, y2_2);
    } 
    // Foreground wave
    stroke(fg_wave_color); strokeWeight(2);
    line(x1, y1_1, x2, y2_1);
  }

}
function sky() {
  // Display sky texture behind surface waves
  
  for(let i=0; i<num_segments; i++){
    // Define wave position
    let dx = w / (num_segments-1); // width of each segment (allow room for rightmost segment)
    let x1 = i*dx;
    //let x2 = (i+1)*dx; 
    let y1_1 = wave_pos[i]; 
    //let y2_1 = wave_pos[i+1];

    // Repeat for background wave
    let y1_2 = wave_pos_2[i]; 
    //let y2_2 = wave_pos_2[i+1];
    
    // Draw all wave segments & sky background
    if (wave_pos[i] >= wave_pos_2[i] ) {
      // Sky background
      stroke(sky_bkgd_color); strokeWeight(1);
      line(x1, 0, x1, y1_2);
    } else {
      // Sky background (pt 2)
      stroke(sky_bkgd_color); strokeWeight(1);
      line(x1, 0, x1, y1_1);
    }
  }

}
function title() {
  // Display game title

  fill(bkgd_color); noStroke(); // background color
  textFont('Helvetica');
  textSize(w * 0.06); textAlign(LEFT);
  text('fshfsh', w * 0.02, h * 0.12);
}
function ocean() {
  // Draw ocean background color (allows buoy to appear floating)

  fill(bkgd_color); noStroke(); // use background color
  
  beginShape();
  vertex(0, h); // bottom left
  for(let i=0; i<num_segments; i++) {
    let x = i * w / (num_segments-1);
    let y = wave_pos[i]; 
    vertex(x, y);
  }
  vertex(w, h); // bottom right
  endShape();

}



function options () {
  // Display options menu (buoys) and allow selection

  // Draw option buoys
  for(let i=0; i<buoy_pos.length; i++) { // loop through all 6 options
    // calculate position
    let x = buoy_pos[i][0]*w                     // buoy x position
    let j = floor(buoy_pos[i][0] * num_segments); // get closest index position
    let y = wave_pos[j] - buoy_dy*w;              // set buoy y position as floating above foreground wave
    buoy_pos[i][1] = y;                           // " "

    // draw buoy
    fill(buoy_color); // red
    strokeWeight(2);
    if(game_option == i) {
      stroke(bg_wave_color); // light grey border when selected
    } else {
      noStroke();
    } 
    ellipse(buoy_pos[i][0] * w, buoy_pos[i][1], buoy_dia*w, buoy_dia*w); // draw buoy
  }


  // Display all icons on buoys
  // boid
  stroke(bg_wave_color); strokeWeight(2); strokeJoin(ROUND); noFill();
  push();
  translate(buoy_pos[0][0] * w, buoy_pos[0][1]);
  rotate(-PI/6); 
  let temp_bh = buoy_dia*w * 0.5;     // temporary boid height (icon display)
  let temp_bw = temp_bh / bwh_ratio; // " " width
  triangle(-temp_bh * 0.4, -temp_bw/2, -temp_bh * 0.4, temp_bw/2, temp_bh * 0.6, 0); // triangular boid
  pop();  

  // barrier
  stroke(bg_wave_color); strokeWeight(2); noFill();
  ellipse(buoy_pos[1][0] * w, buoy_pos[1][1], buoy_dia*w * 0.55, buoy_dia*w * 0.55); // slightly smaller circle inside buoy

  // shark 
  stroke(bg_wave_color); strokeWeight(2); noFill();
  arc(buoy_pos[2][0] * w + buoy_dia*w/2 * 0.25, buoy_pos[2][1] + buoy_dia*w/2 * 0.15, buoy_dia*w * 0.65, buoy_dia*w * 0.65, PI, PI*1.6); // dorsal side of fin
  arc(buoy_pos[2][0] * w + buoy_dia*w/2 * 0.45, buoy_pos[2][1] + buoy_dia*w/2 * 0.15, buoy_dia*w * 0.25, buoy_dia*w * 0.62, PI*1.0, PI*1.5); // ventral " ""
  line(buoy_pos[2][0] * w - buoy_dia*w/2 * 0.65, buoy_pos[2][1] + buoy_dia*w/2 * 0.15, buoy_pos[2][0] * w + buoy_dia*w/2 * 0.65, buoy_pos[2][1] + buoy_dia*w/2 * 0.15); // wave line in icon

  // reset
  stroke(bg_wave_color); strokeWeight(2); noFill();
  arc(buoy_pos[3][0] * w, buoy_pos[3][1], buoy_dia*w * 0.4, buoy_dia*w * 0.4, PI*1.6, PI*1.15); // swept arc line
  fill(bg_wave_color); stroke(bg_wave_color); strokeWeight(1); strokeJoin(ROUND);
  push();
  translate(buoy_pos[3][0] * w + buoy_dia*w*0.06, buoy_pos[3][1] - buoy_dia*w*0.19);
  rotate(PI + PI*1.6); 
  triangle(-buoy_dia*w*0.15 / 2, -buoy_dia*w*0.15 / 3, buoy_dia*w*0.15 / 2, -buoy_dia*w*0.15 / 3, 0, 2*buoy_dia*w*0.15 / 3); // arrow point
  pop(); 

  // info
  fill(bg_wave_color); stroke(bg_wave_color); strokeWeight(1);
  textFont('Courier New');
  textSize(buoy_dia*w * 0.55); textAlign(CENTER, CENTER);
  text('i', buoy_pos[4][0] * w, buoy_pos[4][1]);


  // Redraw foreground waves in front of buoys
  for(let i=0; i<num_segments; i++){
    // Define wave position
    let dx = w / (num_segments-1); // width of each segment (allow room for rightmost segment)
    let x1 = i*dx;
    let x2 = (i+1)*dx; 
    let y1_1 = wave_pos[i]; 
    let y2_1 = wave_pos[i+1];

    // Foreground wave
    stroke(fg_wave_color); strokeWeight(2);
    line(x1, y1_1, x2, y2_1);
  }

  // Set current game option
  if(mouseClick == true) {
    // determine buoy type (if any)
    for(let i=0; i<buoy_pos.length; i++) {
      //if( sq(mouseX-buoy_pos[i][0]*w) + sq(mouseY-buoy_pos[i][1]) <= sq(buoy_dia*1.0) ) {
      if( dist(mouseX, mouseY, buoy_pos[i][0]*w, buoy_pos[i][1]) <= buoy_dia*w/2 * 1.5 ) { // allow slightly bigger hitbox than displayed
        
        game_option = i;             // set game option
        if( i != 4 ) {
          prev_option = game_option; // save previous option 
        }     

      }
    }
    
    //mouseClick = false; // reset mouse boolean
  }

}
function reset() {
  // Reset all boids and barriers if "reset" buoy is selected
  if( game_option == 3 ) {
    boids = [];
    barriers = [];
  }

}
function remove_boid() {
  // Delete boid if (1) out-of-bounds or (2) too close to shark ("eaten")

  for(let i = 0; i < boids.length; i++) {
    // Out-of-bounds detection
    if( boids[i].pos.x < -w/4 || boids[i].pos.x > w+w/4 || boids[i].pos.y < 0 || boids[i].pos.y > h+h/4) { // out-of-bounds lines -> allow boids to be above wave height, all other bounds are screen walls
      boids.splice(i, 1); // remove specific boid from array 
      continue;           // check other boids
    }

    // Shark mode
    if(game_option == 2) {
    if( dist(mouseX, mouseY, boids[i].pos.x, boids[i].pos.y) < shrk_dist*br_d * shrk_eat_dist ) { // boid is within center of shark repulsion region 
        boids.splice(i, 1); // remove specific boid from array 
        continue;           // check other boids
      }
    }

  }

}
function info() {
  // Display information tab for the game. 

  let img_width;            // width of info screen pop-up
  let img_width_pct = 0.80; // image is XX% of minimum screen dimension
  if( h > w ) {
    img_width = w * img_width_pct; // scale image to fit smallest dimension
  } 
  else {
    img_width = h * img_width_pct; // " "
  }

  imageMode(CENTER);

  // Background
  image(info_text_bkgd_img, w/2, h/2, img_width, img_width);

  // Text
  image(info_text_img, w/2, h/2, img_width, img_width);

  // Display all option icons
  // buoy
  let x1 = w/2 - img_width * 0.3023; // buoy position
  let y1 = h/2 + img_width * 0.0290; // " "
  let temp_d = img_width * 0.125;    // buoy diameter
  fill(buoy_color); // red
  stroke(buoy_color); strokeWeight(2);
  ellipse(x1, y1, temp_d, temp_d); // draw buoy
  // boid symbol
  stroke(bg_wave_color); strokeWeight(2); strokeJoin(ROUND); noFill();
  push();
  translate(x1, y1);
  rotate(-PI/6); 
  let temp_bh = temp_d * 0.5;        // temporary boid height (icon display)
  let temp_bw = temp_bh / bwh_ratio; // " " width
  triangle(-temp_bh * 0.4, -temp_bw/2, -temp_bh * 0.4, temp_bw/2, temp_bh * 0.6, 0); // triangular boid
  pop();  

  // buoy
  let y2 = h/2 + img_width * 0.1740; // buoy position
  fill(buoy_color); // red
  stroke(buoy_color); strokeWeight(2);
  ellipse(x1, y2, temp_d, temp_d); // draw buoy
  // barrier symbol
  stroke(bg_wave_color); strokeWeight(2); noFill();
  ellipse(x1, y2, temp_d * 0.55, temp_d * 0.55); // slightly smaller circle inside buoy

  // buoy
  let y3 = h/2 + img_width * 0.318; // buoy position
  fill(buoy_color); // red
  stroke(buoy_color); strokeWeight(2);
  ellipse(x1, y3, temp_d, temp_d); // draw buoy
  // shark symbol
  stroke(bg_wave_color); strokeWeight(2); noFill();
  arc(x1 + temp_d/2 * 0.25, y3 + temp_d/2 * 0.15, temp_d * 0.65, temp_d * 0.65, PI, PI*1.6); // dorsal side of fin
  arc(x1 + temp_d/2 * 0.45, y3 + temp_d/2 * 0.15, temp_d * 0.25, temp_d * 0.62, PI*1.0, PI*1.5); // ventral " ""
  line(x1 - temp_d/2 * 0.65, y3 + temp_d/2 * 0.15, x1 + temp_d/2 * 0.65, y3 + temp_d/2 * 0.15); // wave line in icon

}


// Process all click & touch actions
function mouseReleased () {
  // Turn off mouse click when released.
  if( isMobile == false ) {
    mouseClick = true; 
    return false; // prevent default behavior in browser
  }
}
function touchEnded () {
  // Turn off mouse click when released (mobile version).
  if( isMobile == true ) {
    mouseClick = true; 
    return false; // prevent default behavior in browser
  }
}



function click () {
  // Process all mouse or touch actions using mouseClick variable.
  
  if( mouseClick == true ) {

    // Boid Mode
    if( game_option == 0 ) { // boid placement
      if( mouseX > 0 && mouseX < w && mouseY > wave_ht*h && mouseY < h ) { // mouse must be inside screen
        
        if( boids.length >= max_boid_pop ) { // if limit is exceeded, remove first item from array
          boids.shift();
        }
        let tempB = new Boid(mouseX, mouseY, random(-1,1), random(-1,1), boids); // give boid mouse position with random velocity
        boids.push(tempB); // add boid at end of array

      }
    }

    // Barrier Mode
    if( game_option == 1 ) { // barrier placement
      if( mouseX > br_d/2 && mouseX < w-br_d/2 && mouseY > wave_ht*h+br_d/2 && mouseY < h-br_d/2 ) { // mouse must be inside screen (with added room to place barrier)
        
        let allow_place = true; // temp variable to check whether suggested placement would interfere with other barriers
        for(let i=0; i < barriers.length; i++) { // loop through all barriers to avoid placing on top of one another
          if( dist(mouseX, mouseY, barriers[i].pos.x, barriers[i].pos.y) < br_d ) {
            allow_place = false;
          } else {
            continue;
          }
        } 
        if( allow_place ) { // no overlap detected -> place barrier
          if( barriers.length >= max_barrier_pop ) { // if limit is exceeded, remove first item from array
            barriers.shift();
          }
          let tempB = new Barrier(mouseX, mouseY, barriers); // give boid mouse position with random velocity
          barriers.push(tempB); // add barrier at end of array
        } else {
          //allow_place = true; // reset for next cycle
        }

      }
    }

    // Info Mode
    if( game_option == 4 ) {
      game_option = prev_option; // return to last mode
    }

    //mouseClick = false; // reset mouse click

  }
}


// ------------------------------------------------------------------------------------------------------------



class Boid {

  constructor(tempX, tempY, tempVx, tempVy, otherTemp) {

      // [Define parameters for boids objects]

      // Iso movement mechanics
      this.pnv = 0; // input value for perlin noise function, changing each frame

      // Flocking mechanics variables
      this.ts_acc = createVector(0,0); // temporary acceleration vector for seperation
      this.ta_acc = createVector(0,0); // " " alignment
      this.tc_acc = createVector(0,0); // " " cohesion
      this.av_a = createVector(0,0); // average velocity of nearby individuals for alignment
      this.av_c = createVector(0,0); // " " cohesion
      this.ap_c = createVector(0,0); // average position of nearby individuals for cohesion
      this.nearby_count_a = 0; // count of individuals nearby for alignment
      this.nearby_count_c = 0; // count of individuals nearby for alignment

      // Wall barrier avoidance
      this.ba = createVector(0,0); // vector to accelerate boid to avoid wall/barrier object

      // Display parameters
      this.ang = 0; // current angular direction of boid (in radians)

      // ------------------------------------------------------------------------------------------------------
      
      // [Constructor function for creating boids]

      // Define physics vectors
      this.pos = createVector(tempX, tempY);                       // assign position of each boid
      this.vel = createVector(tempVx * max_vel, tempVy * max_vel); // assigned velocity by component
      this.acc = createVector(0, 0);                               // no initial acceleration
      
      // Declare other boids
      this.others = otherTemp;
  
  } 



  flock() {
    // Boid algorithm to determine bulk movement of individuals
    
    for(let j = 0; j < this.others.length; j++) { // loop through all other boids
      // Parameters for flocking mechnaics
      let dp = p5.Vector.sub(this.others[j].pos, this.pos); // distance vector between boids
      let dis = dp.mag();                                   // distance between boids
          
      // Seperation
      if( dis < dist_s ) {   // nearby boids
        this.ts_acc.add(dp); // vector sum of distance to all nearby individuals 
      }
      
      // Alignment
      if( dis < dist_a && dis > dist_s/2 ) { // nearby boids -> ignore self-counting (use seperation distance for min distance)
        this.nearby_count_a += 1;
        this.av_a.add(this.others[j].vel);   // add neighbors velocity to running total
      }
      
      // Cohesion
      if( dis < dist_c && dis > dist_s/2) { // nearby boids -> ignore self-counting (see above)
        this.nearby_count_c += 1;
        this.ap_c.add(this.others[j].pos);  // add neighbors position to running total
        this.av_c.add(this.others[j].vel);  // " " velocity
      }
      
    }
    
    // modify acceleration components (as needed)
    this.ts_acc.mult(-scl_s); // accelerate in opposite direction of nearby boids, scale down magnitude
    
    // set alignment vector
    if(this.nearby_count_a > 0) {
      this.av_a.mult(1.0 / this.nearby_count_a);       // calculate average from sum
      let dv_a = p5.Vector.sub( this.av_a, this.vel ); // difference between local average velocity and boid velocity
      this.ta_acc.set( dv_a.mult(scl_a) );             // scale acceleration 
    } 
    
    // set cohesion vector
    if(this.nearby_count_c > 0) {
      this.av_c.mult(1.0 / this.nearby_count_c); // average velocity
      this.ap_c.mult(1.0 / this.nearby_count_c); // average position
      let dv_c = p5.Vector.sub( this.ap_c, this.pos ); 
      this.tc_acc.set( dv_c.mult(scl_c) );       // scale acceleration 
    } 
    
    // Add acceleration components from each behavior
    this.acc.add(this.ts_acc);
    this.acc.add(this.ta_acc); 
    this.acc.add(this.tc_acc);  
  }



  iso() {
    // Single species movement mechanics
    
    // create random motion
    this.pnv += pnvs; // get new value for perlin noise function
    let vel_rand = createVector( map(noise(this.pnv),0,1,-vr_scl, vr_scl), map(noise(this.pnv),0,1,-vr_scl, vr_scl) );
    this.vel.add(vel_rand); // add random components
    
    // create acceleration vector to maintain set speed
    let dv = max_vel - this.vel.mag(); // difference between current speed and max speed (discourages stopping or going too fast)
    let dvel = p5.Vector.mult(this.vel, dv*dv_acc); // positive = speed up, negative = slow down
    this.vel.add( dvel ); // proportional controller for speed
  }



  walls() {
    // Mechanics to avoid window barriers

    let ignore_flock = false; // whether to avoid cohesion/alignment/seperation accelerations near walls (prevents groups from pushing members out of bounds)

    // determine wave height above boid -> allows for "jumping" out of water effect
    let dx = w / (num_segments-1);  // width of each segment (see wave code)
    let i = round(this.pos.x / dx); // index of wave above boid
    let wave_y_pos = wave_pos[i];   // height of wave above current boid

    // determine boid position a given timestep in the future
    let next_pos = this.pos.copy().add(this.vel.copy().mult(barr_predict)); // position of boid XX frames in future -> used to avoid barriers before it approaches it

    // Determine repulsion acceleration for DISPLAY WINDOW
    if( this.pos.x < wall_dist*w) { // LEFT wall
      ignore_flock = true;                                // ignore flock
      let a = acc_mag(this.pos.x, 0, -this.vel.x, w_acc); // determine acceleration vector based on distance to wall
      this.ba.add(a, 0);                                  // set acceleration vector
    }
    else if( this.pos.x > w - wall_dist*w) { // RIGHT wall
      ignore_flock = true;                               // see above
      let a = acc_mag(this.pos.x, w, this.vel.x, w_acc); // " "
      this.ba.add(-a, 0);                                // " "
    }
    else if( this.pos.y < (wave_ht*h + wall_dist*w * 0.4) && this.pos.y > wave_y_pos) { // WAVE boundary line. boid is in water near wave surface but NOT in air -> allow more "give" as boids can approach surface of water
      ignore_flock = true;                                        // see above
      let a = acc_mag(this.pos.y, wave_ht*h, -this.vel.y, w_acc); // " "
      this.ba.add(0, a);                                          // " "
    }   
    else if( this.pos.y > h - wall_dist*w) { // BOTTOM wall
      ignore_flock = true;                               // see above
      let a = acc_mag(this.pos.y, h, this.vel.y, w_acc); // " "
      this.ba.add(0, -a);                                // " "
    }

    // Out-of-water mechanics ("jumping")
    if( this.pos.y <= wave_y_pos ) { // boid is above wave height
      ignore_flock = true;    // see above (wall barrier mechanics)
      this.ba.add(0, g_acc);  // use stronger acceleration for "gravity" pushing boid back in the water
    }


    // Avoid Barriers -> accelerate in opposite direction
    for(let i=0; i<barriers.length; i++) {
      let d = dist(this.pos.x, this.pos.y, barriers[i].pos.x, barriers[i].pos.y); // distance between boid and barrier
      if( d < barr_dist*br_d ) { // if boid is too close to barrier
        ignore_flock = true;                                                    // see above (wall barrier mechanics)
        let dp = p5.Vector.sub(next_pos, barriers[i].pos);                      // difference in boid and barrier position, direction to accelerate boid away from barrier
        dp.normalize();                                                         // normalize vector
        let v_rel = this.vel.copy().dot(dp);                                    // velocity relative to the barrier -> positive if moving away 
        let a = ba_acc * (d / (barr_dist*br_d)) * (-v_rel / max_vel);           // map distance and speed to acceleration -> similar to wall procedure
        if ( a < min_w_acc ) {                                                  // prevent boids form orbitting around barrier
          a = min_w_acc;  
        } 
        //this.ba.set( p5.Vector.mult(dp, ba_acc) );  // set constant acceleration
        if( this.pos.y > wave_y_pos ) {         // ignore barrier repulsion near the surface (prevents boids from "flying")
          this.ba.add( p5.Vector.mult(dp, a) ); // set acceleration based on relative velocity
        } 
      }
    }

    // Avoid Shark -> perform similar procedure as barrier avoidance
    if( game_option == 2 && this.pos.y > wave_y_pos) { // shark mode -> only active when boid is in the water
      let m = createVector(mouseX, mouseY);                         // mouse position vector
      if( dist(this.pos.x, this.pos.y, mouseX, mouseY) < shrk_dist*br_d ) { // if boid is too close to shark
        ignore_flock = true;                                                // see above (wall barrier mechanics)
        let dp = p5.Vector.sub(this.pos, m);                                // difference in boid and shark position, direction to accelerate boid away
        dp.normalize();                                                     // normalize vector
        this.ba.add( p5.Vector.mult(dp, shrk_acc) );                        // set constant acceleration
        // remove top wall repulsion force
        if( this.pos.y < (wave_ht*h + wall_dist*w * 0.4) ) {
          let a = acc_mag(this.pos.y, wave_ht*h, -this.vel.y, w_acc); // see above (wall barrier mechanics)
          this.ba.sub(0, a);                                          // " "
        }
      } 
    }


    // Ignore flock if near barriers -> prevents flock from pushing members into walls/barriers
    if( ignore_flock ) {
      this.acc.sub(this.ts_acc); // cancel out previously added vector values
      this.acc.sub(this.ta_acc); // " "
      this.acc.sub(this.tc_acc); // " "
    }


    this.acc.add(this.ba); // add wall barrier repulsion to overall acceleration 
       
  }



  move() {
    // Convert the acceleration and velocity vectors into new display positions  
    
    // update current physics states
    if( this.vel.mag() < abs_max_vel ) {
      this.vel = this.vel.add(this.acc); // increase velocity only if below max threshold
    } 
    this.pos = this.pos.add(this.vel*fpsr);    
    
    // reset acceleration
    this.acc.set(0,0);
    this.ts_acc.set(0,0);
    this.ta_acc.set(0,0);
    this.tc_acc.set(0,0);
    
    // reset variables
    this.av_a.set(0,0);
    this.av_c.set(0,0);
    this.ap_c.set(0,0);
    this.ba.set(0,0);
    this.nearby_count_a = 0; // reset count
    this.nearby_count_c = 0; // " "
  }



  display() {
    // Display each boid using position and oriention vectors. 

    // determine orientation
    this.ang = atan2(this.vel.y, this.vel.x);
    
    // calculate color based on position and speed
    let b_hue = map(this.ang, -PI, PI, 0, 360);          // hue based on direction
    let b_sat = map(this.vel.mag(), 0, max_vel, 10, 30); // saturation based on speed
    const b_bri = 50;                                    // set brightness at constant 50%
    
    // set color
    colorMode(HSB, 360, 100, 100);                         // use HSB color mode
    let b_color = color(b_hue, b_sat, b_bri);              // fill color of boid
    let b_color_border = color(b_hue, b_sat, b_bri * 0.2); // border stroke color
    
    // draw and color boid
    fill(b_color); stroke(b_color_border); strokeWeight(1);
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.ang); 
    triangle(-bh/3, -bw/2, -bh/3, bw/2, 2*bh/3, 0); // triangular boid
    pop();  
  }



  debug() {
    // Display hidden metrics for troubleshooting mechanics. 
    
    // velocity vector
    //noFill(); stroke('#F2AE25'); strokeWeight(1); // orange
    //line(this.pos.x, this.pos.y, this.pos.x + this.vel.x*50, this.pos.y + this.vel.y*50);
    
    // draw acceleration line
    //noFill(); stroke('#F2EE5F'); strokeWeight(3); // yellow
    //line(pos.x, pos.y, pos.x + ta_acc.x*30000, pos.y + ta_acc.y*30000); // alignment acceleration
    //noFill(); stroke('#94D375'); strokeWeight(3); // green
    //line(pos.x, pos.y, pos.x + av.x*100, pos.y + av.y*100); // average velocity vector
    
    // display nearby count
    //fill('#FFFFFF'); noStroke(); textSize(20);
    //text(this.nearby_count_c, this.pos.x - 30, this.pos.y + 30);
    
    // draw reference regions
    //noFill(); stroke('#CB1D20'); strokeWeight(1);        // red
    //ellipse(this.pos.x, this.pos.y, 2*dist_s, 2*dist_s); // seperation
    //noFill(); stroke('#64B74E'); strokeWeight(1);        // green
    //ellipse(this.pos.x, this.pos.y, 2*dist_a, 2*dist_a); // alignment
    //noFill(); stroke('#E7ED79'); strokeWeight(1);        // yellow
    //ellipse(this.pos.x, this.pos.y, 2*dist_c, 2*dist_c); // cohesion
    
    // show wall lines for window frame
    //stroke('#FFFF00'); strokeWeight(1);
    //line(wall_dist*w, 0, wall_dist*w, h);     // left 
    //line(w-wall_dist*w, 0, w-wall_dist*w, h); // right
    //line(0,(wave_ht*h + wall_dist*w * 0.4), w, (wave_ht*h + wall_dist*w * 0.4) );         // top
    //line(0, h-wall_dist*w, w, h-wall_dist*w); // bottom
  }

}



function acc_mag(xp, xw, v, a_max) {
  // Compute magnitude of acceleration based on boid position (xp), wall position (xw), relative speed (v), and maximum acceleration desired (a_max)
  let d = pow( abs(xp - xw) / (wall_dist*w) , acc_wall_pwr);  // normalized distance between boid and wall -> scale using power law for added repulsion closer to wall
  let a = map(d, 0, 1, a_max, 0) ;                            // linearly map "distance" to wall with acceleration value
  
  if( v > 0 ) { // boid is moving towards wall
    a = a * (v / max_vel); // scale acceleration based on boid speed relative to barrier -> slower speed = less acceleration
  } else {
    a = min_w_acc;         // if boid is moving away from wall, set minimum acceleration
  }

  if ( a < min_w_acc) {
    a = min_w_acc;         // keep acceleration at or above minimum if elsewise below
  }  

  return a; 
}



// ------------------------------------------------------------------------------------------------------------



class Barrier {

  constructor(tempX, tempY, otherTemp) {

      // Define position vector
      this.pos = createVector(tempX, tempY); // assign position of each barrier
      
      // Declare other barriers
      this.others = otherTemp;
  
  } 

  display() {
    // Creates graphics for each barrier

    // Draw border
    noFill();
    stroke(buoy_color); strokeWeight(2);
    ellipse(this.pos.x, this.pos.y, br_d, br_d); 

    // Draw pattern on inside of barrier
    let dx = w / (num_segments-1); // width between segments (same positions as sky pattern)
    let r = br_d/2; // radius of each buoy
    let i_start = ceil( (this.pos.x - r) / dx );  // index of first segment within width of buoy
    let i_end = floor( (this.pos.x + r) / dx ); // " " last segment " "
    for(let i=i_start; i<=i_end; i++) { // only loop through necessary segments
      // calculate length
      let x = i*dx; // position of line segment
      //let dh = sqrt( sq((buoy_dia*w)/2) - sq(x - this.pos.x) ); 
      let dh = sqrt( sq(r) - sq(x - this.pos.x) ) - 1; // half height of each line segment inside circle
      // draw line segment
      stroke(buoy_color); strokeWeight(2); // same color as above
      line(x, this.pos.y - dh, x, this.pos.y + dh);
    }
 
  }

}