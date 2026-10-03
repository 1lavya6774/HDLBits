import type { ProjectFile, PresetDesign } from '../types/playground.ts';

export const DEFAULT_DESIGN_VERILOG = `// 4-bit synchronous up-counter with active-low asynchronous reset
module counter (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       enable,
    output reg  [3:0] count
);

    // Sequential logic with active-low asynchronous reset
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            count <= 4'b0000;
        end else if (enable) begin
            count <= count + 1'b1;
        end
    end

endmodule
`;

export const DEFAULT_TESTBENCH_VERILOG = `\`timescale 1ns / 1ps

module tb_counter;
    reg clk;
    reg rst_n;
    reg enable;
    wire [3:0] count;

    // Instantiate Unit Under Test (UUT)
    counter uut (
        .clk(clk),
        .rst_n(rst_n),
        .enable(enable),
        .count(count)
    );

    // Clock generator (100MHz clock: 10ns period)
    always #5 clk = ~clk;

    initial begin
        // Initialize inputs
        clk = 0;
        rst_n = 0;
        enable = 0;

        // Apply active-low reset pulse: de-assert at 15ns
        #15 rst_n = 1;

        // Enable counting at 20ns
        #5 enable = 1;

        // Let the counter run for 80ns (8 clock cycles)
        #80 enable = 0;

        // Pause for 20ns
        #20 enable = 1;

        // Re-enable and count for 40ns
        #40 rst_n = 0; // Asynchronous reset pulse

        #10 rst_n = 1;

        #30;
        $finish;
    end

endmodule
`;

export const PRESET_DESIGNS: PresetDesign[] = [
  {
    id: 'full-adder',
    title: '1-Bit Full Adder (Combinational)',
    description: 'Classic 1-bit full adder demonstrating Auto-Harness exhaustive truth-table simulation.',
    designCode: `// 1-Bit Full Adder with XOR and Majority carry
module full_adder (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    // Sum bit: 3-input XOR
    assign sum  = a ^ b ^ cin;

    // Carry-out bit: majority function
    assign cout = (a & b) | (b & cin) | (a & cin);

endmodule
`,
    testbenchCode: `\`timescale 1ns / 1ps

module tb_full_adder;
    reg a;
    reg b;
    reg cin;
    wire sum;
    wire cout;

    // Instantiate Unit Under Test
    full_adder uut (
        .a(a),
        .b(b),
        .cin(cin),
        .sum(sum),
        .cout(cout)
    );

    integer i;

    initial begin
        $dumpfile("dump.vcd");
        $dumpvars(0, tb_full_adder);

        // Exhaustive truth table for all 8 states (000 to 111)
        for (i = 0; i < 8; i = i + 1) begin
            {a, b, cin} = i[2:0];
            #10;
        end

        #10;
        $finish;
    end

endmodule
`,
  },
  {
    id: 'counter-4bit',
    title: '4-Bit Counter (Synchronous / Async rst_n)',
    description: 'Standard 4-bit up-counter with active-low asynchronous reset and enable.',
    designCode: DEFAULT_DESIGN_VERILOG,
    testbenchCode: DEFAULT_TESTBENCH_VERILOG,
  },
  {
    id: 'latch-demo',
    title: 'Combinational ALU (Latch Inference Demo)',
    description: 'Illustrates incomplete branch assignments that trigger the [Synth 8-327] latch warning.',
    designCode: `// Example ALU with intentional latch inference on 'result'
module alu_latch (
    input  wire [1:0] op,
    input  wire [3:0] a,
    input  wire [3:0] b,
    output reg  [3:0] result
);

    // Intentional missing branch condition causes latch inference
    always @(*) begin
        case (op)
            2'b00: result = a + b;
            2'b01: result = a - b;
            2'b10: result = a & b;
            // Missing 2'b11 and missing default branch!
        endcase
    end

endmodule
`,
    testbenchCode: `\`timescale 1ns / 1ps

module tb_alu_latch;
    reg [1:0] op;
    reg [3:0] a;
    reg [3:0] b;
    wire [3:0] result;

    alu_latch uut (
        .op(op),
        .a(a),
        .b(b),
        .result(result)
    );

    initial begin
        a = 4'd5;
        b = 4'd3;
        op = 2'b00;

        #10 op = 2'b01;
        #10 op = 2'b10;
        #10 op = 2'b11; // Unassigned in case -> latch retains previous value
        #15 op = 2'b00;
        #10;
        $finish;
    end

endmodule
`,
  },
  {
    id: 'fsm-seq-detector',
    title: '1011 Sequence Detector (FSM)',
    description: 'Finite State Machine recognizing binary pattern 1011 with single-bit output flag.',
    designCode: `// Non-overlapping 1011 Sequence Detector FSM
module seq_detector (
    input  wire clk,
    input  wire rst_n,
    input  wire data_in,
    output reg  detected
);

    localparam S0 = 3'b000;
    localparam S1 = 3'b001; // saw 1
    localparam S2 = 3'b010; // saw 10
    localparam S3 = 3'b011; // saw 101
    localparam S4 = 3'b100; // saw 1011

    reg [2:0] state, next_state;

    // State Register
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            state <= S0;
        else
            state <= next_state;
    end

    // Next State Logic
    always @(*) begin
        next_state = state;
        case (state)
            S0: next_state = (data_in) ? S1 : S0;
            S1: next_state = (data_in) ? S1 : S2;
            S2: next_state = (data_in) ? S3 : S0;
            S3: next_state = (data_in) ? S4 : S2;
            S4: next_state = (data_in) ? S1 : S0;
            default: next_state = S0;
        endcase
    end

    // Output Logic
    always @(*) begin
        detected = (state == S4);
    end

endmodule
`,
    testbenchCode: `\`timescale 1ns / 1ps

module tb_seq_detector;
    reg clk;
    reg rst_n;
    reg data_in;
    wire detected;

    seq_detector uut (
        .clk(clk),
        .rst_n(rst_n),
        .data_in(data_in),
        .detected(detected)
    );

    always #5 clk = ~clk;

    initial begin
        clk = 0;
        rst_n = 0;
        data_in = 0;

        #12 rst_n = 1;

        // Feed pattern: 1, 0, 1, 1 (Detected at 4th bit)
        #10 data_in = 1;
        #10 data_in = 0;
        #10 data_in = 1;
        #10 data_in = 1;

        // Extra stream: 0, 1, 1
        #10 data_in = 0;
        #10 data_in = 1;
        #10 data_in = 1;

        #20;
        $finish;
    end

endmodule
`,
  },
  {
    id: 'comb-loop',
    title: 'Combinational Loop (Watchdog Guardrail)',
    description: 'Circular combinational feedback to demonstrate the 100,000 delta-cycle watchdog safeguard.',
    designCode: `// Deliberate circular combinational feedback
module comb_loop_demo (
    input  wire a,
    output wire y
);
    // Unbuffered inverter feedback creates infinite zero-delay oscillations
    assign y = ~(y ^ a);

endmodule
`,
    testbenchCode: `\`timescale 1ns / 1ps

module tb_comb_loop;
    reg a;
    wire y;

    comb_loop_demo uut (.a(a), .y(y));

    initial begin
        a = 1;
        #10 a = 0;
        #10;
        $finish;
    end

endmodule
`,
  }
];

export const INITIAL_FILES: ProjectFile[] = [
  {
    id: 'design.v',
    name: 'design.v',
    type: 'design',
    content: DEFAULT_DESIGN_VERILOG,
  },
  {
    id: 'testbench.v',
    name: 'testbench.v',
    type: 'testbench',
    content: DEFAULT_TESTBENCH_VERILOG,
  },
  {
    id: 'synth.log',
    name: 'synth.log',
    type: 'log',
    content: `// Verilog Studio Synthesis Engine\n// Status: Ready. Click 'Synthesize' or run 'synth_design' to elaborate RTL.\n`,
    isReadOnly: true,
  },
];
