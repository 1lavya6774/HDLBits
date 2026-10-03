export function generateVivadoTcl(topModule: string, tbModule: string): string {
  return `# ==============================================================================
# Verilog Studio - AMD Xilinx Vivado Automated Execution Script
# Target Device: Artix-7 xc7a35tcpg236-1 (Basys 3 Lab Standard)
# Execution: vivado -mode batch -source scripts/run_vivado.tcl
# ==============================================================================

set script_path [file normalize [info script]]
set script_dir [file dirname $script_path]
set project_root [file normalize "$script_dir/.."]

puts "======================================================================"
puts "Verilog Studio -> Starting Headless Vivado EDA Pipeline"
puts "Project Root: $project_root"
puts "Top Module:   ${topModule}"
puts "TB Module:    ${tbModule}"
puts "======================================================================"

# 1. Project Creation in isolated directory
set prj_dir "$project_root/vivado_prj"
file mkdir $prj_dir
cd $prj_dir

create_project -force ${topModule}_prj $prj_dir -part xc7a35tcpg236-1

# 2. Add Synthesizable RTL Files
add_files -fileset sources_1 "$project_root/rtl/design.v"
set_property top ${topModule} [current_fileset]
update_compile_order -fileset sources_1

# 3. Add Simulation Testbench Files
add_files -fileset sim_1 "$project_root/tb/testbench.v"
set_property top ${tbModule} [get_filesets sim_1]
set_property top_lib xil_defaultlib [get_filesets sim_1]
update_compile_order -fileset sim_1

# 4. Behavioral Simulation (xsim)
puts "======================================================================"
puts "Verilog Studio -> Launching Behavioral Simulation (xsim)..."
puts "======================================================================"
set_property -name {xsim.simulate.runtime} -value {1000ns} -objects [get_filesets sim_1]
launch_simulation -simset sim_1 -mode behavioral

# 5. Logic Synthesis & Technology Mapping
puts "======================================================================"
puts "Verilog Studio -> Running Logic Synthesis (synth_design)..."
puts "======================================================================"
synth_design -top ${topModule} -part xc7a35tcpg236-1

# 6. Resource Utilization & Cell Reports
puts "======================================================================"
puts "Verilog Studio -> Generating Synthesis Reports..."
puts "======================================================================"
report_utilization -file "$prj_dir/utilization_report.txt" -pb "$prj_dir/utilization_report.pb"
report_timing_summary -file "$prj_dir/timing_summary.txt"

puts "======================================================================"
puts "Verilog Studio -> Vivado Pipeline Finished Successfully!"
puts "Artifacts saved in: $prj_dir"
puts "======================================================================"
exit
`;
}
