// canvas constants
const W = 650;
const H = 650;
var xnum = 100;
var ynum = 100;
var GRIDSIZE_X = W/xnum;
var GRIDSIZE_Y = H/ynum;
var t = 0;
var iterations = 0;

// simulation parameters
var T = 2.5; // temperature
var N = 100; // number of times iterate for each square
var squares = [];
var clusters = {};
var mag_data = [];
var energy_data = [];

// GUI elements
var paused;
var mag_button;
var data_span;
var cluster_div;

// Square data structure, holds spin and position information
function Square(xpos, ypos, dir) {
  this.x = xpos;
  this.y = ypos;
  this.spin = dir;
  this.draw = function() {
    var color_ = 51; // black for spin up
    if (this.spin == -1) {color_ = 250; } // grey for spin down 
    fill(color_);
    rect(xpos*GRIDSIZE_X, ypos*GRIDSIZE_Y, GRIDSIZE_X, GRIDSIZE_Y);
  }
  this.is_neighbor_to = function(other) {
    // returns if this square is a neighbor to a given square other
    if (this.x == other.x) { // same x, different y
      if ( (other.y-1+ynum)%ynum == this.y ) {
        return true;
      } else if ( (other.y+1+ynum)%ynum == this.y) {
        return true;
      }
    } else if (this.y == other.y) { // different x, same y
      if ( (other.x-1+xnum)%xnum == this.x ) {
        return true;
      } else if ( (other.x+1+xnum)%xnum == this.x ) {
        return true;
      }
    }
    return false;
  }
}


// generates all squares in squares[][] array
function setup_squares(x_num,y_num) {
  var arr = [];
  for(var i = 0; i < x_num; i++) {
    var square_row = [];
    for(var j = 0; j < y_num; j++) {
      var rand = 1;
      if (Math.random() < 0.5) { rand = -1; }
      square_row[j] = new Square(i, j, rand);
    }
    arr[i] = square_row;
  }
  return arr;
}


// calculates Ediff of flipping a particular element
function deltaU(i, j) {
  // calcuate the change in energy of flipping the dipole at (i,j)
  // using periodic boundary conditions
  var l = squares[((i-1)+xnum)%xnum][j].spin;
  var r = squares[((i+1)+xnum)%xnum][j].spin;
  var t = squares[i][((j-1)+ynum)%ynum].spin;
  var b = squares[i][((j+1)+ynum)%ynum].spin;
  var delta = 2*squares[i][j]*(l+r+t+b);
  return 2*squares[i][j].spin*(l+r+t+b);
}


// main monte carlo algorithm
function iterate() {
  for (var iteration = 0; iteration < N*xnum*ynum; iteration++) {
    i = Math.floor(Math.random()*xnum);
    j = Math.floor(Math.random()*ynum);
    Ediff = deltaU(i, j);
    if (Ediff <= 0 || Math.random() < exp(-Ediff/T)) {
      squares[i][j].spin = -squares[i][j].spin;
    }
  }
  iterations+=N;
  if (mag_button.checked()) { mag_data.push(total_mag()); }
  if (energy_button.checked()) { energy_data.push(total_energy()); }
}


// draw all the squares
function draw_squares() {
  background(250);
  stroke(0);
  strokeWeight(0.1);
  for (var i = 0; i < xnum; i++) {
      for (var j = 0; j < ynum; j++) {
        squares[i][j].draw();
      }
  }
  update_data_span();
}


// update displayed data on GUI
function update_data_span() {
  noStroke();
  fill(245);
  rect(W+10,220,140,105);
  var Ustring = "";
  if (energy_button.checked()) {
    Uavg = 0;
    for (var i = 0; i < energy_data.length; i++) {
      Uavg += energy_data[i];
    }
    Ustring = `Cum avg U: ${Math.round(Uavg/xnum/ynum/energy_data.length*100)/100}`;
  }
  data_span.html(`
    <span style='display:block;'>Paused: ${paused}</span>
    <span style='display:block;'>Temperature: ${T}</span>
    <span style='display:block;'>Size: ${ynum}x${xnum}</span>
    <span style='display:block'>Iterations: ${iterations}</span>
    <span style='display:block'>${Ustring}</span>
  `); 
}


// calcualte cluster size using crazy algorithm I conjured
function calculate_cluster_size() {
  clusters = {'1':[],'-1':[]}; // keeps track of clusters (structure of separate arrays of arrays of squares for SU and SD)
  for (var i = 0; i < xnum; i++) { // for all squares: x
    for (var j = 0; j < ynum; j++) { // y
      this_square = squares[i][j]; // keep track of if this_square is a neighbor to any squares in any cluster in spin_groups
      var spin_groups = clusters[this_square.spin]; // take appropriate SU or SD array of clusters
      var found_a_neighbor = []; // keep track of if this_square is a neighbor to any squares in any cluster in spin_groups
      for (var k = 0; k < spin_groups.length; k++) {  // for all clusters in spin groups
        found_a_neighbor[k] = false;
        for (var w = 0; w < spin_groups[k].length; w++) { // for each square in a cluster
          if (squares[i][j].is_neighbor_to(spin_groups[k][w])) { // is neighbor to current square?
            found_a_neighbor[k] = true;
            break;
          }
        }
      }
      // append together any groups that need to merge now
      var temp_arr = [];
      // combine spin groups that should be comgined now
      for (var k = 0; k < spin_groups.length; k++) {
        if (found_a_neighbor[k]) {
          temp_arr = temp_arr.concat(spin_groups[k]);
        }
      }
      temp_arr = temp_arr.concat(this_square); // add the new oneu
      // delete all of the old spin groups
      for (var k = spin_groups.length-1; k >= 0; k--) {
        if (found_a_neighbor[k]) {
          spin_groups.splice(k,1);
        }
      }
      // replace with the big new one
      spin_groups = spin_groups.concat([temp_arr]);
      // put into clusters
      clusters[this_square.spin] = spin_groups;
    }
  }
  // calcuate actual cluster sizes and stats
  var cluster_sizes = [];
  var cluster_size_sum = 0;
  var num_clusters = 0;
  var num_SU = 0;
  var num_SD = 0;
  // sum size of all clusters
  for (var i = 0; i < clusters[1].length; i++) {
    cluster_sizes.push(clusters[1][i].length);
    cluster_size_sum += clusters[1][i].length;
    num_clusters++;
    num_SU+=clusters[1][i].length;
  }
  for (var i = 0; i < clusters[-1].length; i++) {
    cluster_sizes.push(clusters[-1][i].length);  
    cluster_size_sum += clusters[-1][i].length;
    num_clusters++;
    num_SD+=clusters[-1][i].length;
  }
  cluster_sizes.sort(function(a,b){return a-b});
  // calculate median
  var median;
  if (cluster_sizes.length%2==0) {
    len = cluster_sizes.length;
    median = (cluster_sizes[len/2]+cluster_sizes[len/2-1])/2;
  } else {
    median = cluster_sizes[(cluster_sizes.length-1)/2];
  }
  // calculate magnetization / saturation
  var SU_sat = num_SU/xnum/ynum;
  var SD_sat = num_SD/xnum/ynum;
  var out = {
    'mean': cluster_size_sum/num_clusters,
    'median':  median,
    'smallest': cluster_sizes[0],
    'largest': cluster_sizes[cluster_sizes.length-1],
    'num': num_clusters,
    'SU_sat': SU_sat,
    'SD_sat': SD_sat
  };
  return out;
}


function update_cluster_div(data) {
  noStroke();
  fill(245);
  cluster_div.html(`
    <span style='display:block'>Number of Clusters: ${data.num}</span>
    <span style='display:block;'>Mean Cluster Size: ${Math.round(data.mean*100)/100}</span>
    <span style='display:block;'>Median Cluster Size: ${data.median}</span>
    <span style='display:block;'>Smallest Cluster Size: ${data.smallest}</span>
    <span style='display:block'>Largest Cluster Size: ${data.largest}</span>
    <span style='display:block'>Saturation: ${Math.floor(data.SU_sat*100)}% SU, ${Math.floor(data.SD_sat*100)}% SD</span>
    <span style='display:block'>Magnetization: ${total_mag()}</span>
    <span style='display:block'>Energy: ${total_energy()}, Inst avg U: ${Math.round(total_energy()/xnum/ynum*100)/100}</span>  
  `);   
}


// calculate the total magnetization of the current state
function total_mag() {
  var mag = 0;
  for (var i = 0; i < xnum; i++) {
    for (var j = 0; j < ynum; j++) {
      mag += squares[i][j].spin;
    }
  }
  return mag;
}


// calcualte the total energy of the current state
function total_energy() {
  var U = 0;
  // calculate energy of columns
  for (var i = 0; i < xnum; i++) {
    for (var j = 0; j < ynum; j++) {
      if (ynum > 1) {
        U += squares[i][j].spin * squares[i][(j+1)%ynum].spin;
      }
    }
  }
  // calculate energy of rows
  for (var j = 0; j < ynum; j++) {
    for (var i = 0; i < xnum; i++) {
      if (xnum>1) {
        U += squares[i][j].spin * squares[(i+1)%xnum][j].spin;
      }
    }
  }
  return U;
}


// setup the canvas
function setup() {
  cnv = createCanvas(W, H);
  background(250);
  // create GUI
  pause_button = createButton("Play/Pause Simulation");
  pause_button.position(W+10, 20);
  paused = true;
  pause_button.mousePressed(function() {
    paused = !paused;
    draw_squares();
    update_data_span();
  });
  energy_button = createCheckbox('Log Energy', false);
  energy_button.position(W+10,40);
  energy_button.mousePressed(function() {
    if (energy_button.checked()) {
      energy_data = [];
    }
  });
  mag_button = createCheckbox('Log Magnetization', false);
  mag_button.position(W+10,60);
  mag_button.mousePressed(function() {
    if (mag_button.checked()) {
      mag_ = [];  
    }
  });
  T_div = createDiv("Temp");
  T_div.position(W+10,100);
  T_input = createInput(T);
  T_input.parent(T_div);
  T_input.position(50,0);
  x_div = createDiv("X_Size");
  x_div.position(W+10,120);
  x_input = createInput(xnum);
  x_input.parent(x_div);
  x_input.position(50,0);
  y_div = createDiv("Y_Size");
  y_div.position(W+10,140);
  y_input = createInput(ynum);
  y_input.parent(y_div);
  y_input.position(50,0);
  N_div = createDiv("Itns/trn");
  N_div.position(W+10,160);
  N_input = createInput(N);
  N_input.parent(N_div);
  N_input.position(50,0);
  reset_button = createButton("Reset Simulation");
  reset_button.position(W+10+50,185);
  reset_button.mousePressed(function() {
    iterations = 0;
    T = Number(T_input.value());
    N = Number(N_input.value());
    mag_data = [];
    energy_data = [];
    xnum = Number(x_input.value());
    ynum = Number(y_input.value());
    GRIDSIZE_X = W/xnum;
    GRIDSIZE_Y = H/ynum;
    squares = setup_squares(xnum,ynum);
    draw_squares();
  });
  data_span = createSpan();
  update_data_span();
  data_span.position(W+20,225);
  download_energy = createButton('Download energy.json');
  download_energy.mousePressed(function() {
    saveJSON(energy_data, 'energy');
  });
  download_energy.position(W+10, 360);
  download_mag = createButton('Download magnetization.json');
  download_mag.mousePressed(function() {
    saveJSON(mag_data, 'magnetization');
  });
  download_mag.position(W+10,385);
  cluster_span = createSpan();
  cluster_span.position(W+10,440);
  cluster_span.style('width','250px');
  cluster_button = createButton("Calculate Cluster Stats");
  cluster_button.parent(cluster_span);
  cluster_div = createDiv();
  cluster_div.parent(cluster_span);
  cluster_div.position(0,20);
  cluster_button.mousePressed(function() {
    cluster_data = calculate_cluster_size();
    update_cluster_div(cluster_data);
  });
  sc_span = createSpan();
  sc_span.position(W+10, 620);
  sc_input = createInput('screenshot.png');
  sc_input.parent(sc_span);
  sc_button = createButton("Screenshot");
  sc_button.parent(sc_span);
  sc_button.mousePressed(function() {
    saveCanvas(sc_input.value());
  });
  
  // setup squares
  squares = setup_squares(xnum,ynum);
  draw_squares();
}


// main loop
function draw() {
  if (!paused) { // iterate only if not paused
    iterate(); // do ising algorithm
    // only every 100ms, draw all the squares again
    // (there will be more iterations than displayed)
    if (millis() - t > 100) {
      t = millis();
      draw_squares();
    }
  }
}
