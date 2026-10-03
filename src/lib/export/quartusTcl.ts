export function generateQuartusTcl(topModule: string): string {
  return `# ==============================================================================
# Verilog Studio - Intel Quartus Prime Automated Elaboration Script
# Target Device Family: Cyclone IV E
# Execution: quartus_sh -t scripts/run_quartus.tcl
# ==============================================================================

set script_path [file normalize [info script]]
set script_dir [file dirname $script_path]
set project_root [file normalize "$script_dir/.."]

puts "======================================================================"
puts "Verilog Studio -> Starting Intel Quartus Prime Elaboration Pipeline"
puts "Project Root: $project_root"
puts "Top Module:   ${topModule}"
puts "======================================================================"

load_package flow

set prj_dir "$project_root/quartus_prj"
file mkdir $prj_dir
cd $prj_dir

# 1. Initialize Quartus Project
if {[project_exists ${topModule}]} {
    project_open -revision ${topModule} ${topModule}
} else {
    project_new -family "Cyclone IV E" -part "EP4CE22F17C6" ${topModule}
}

# 2. Assign RTL Source Files
set_global_assignment -name VERILOG_FILE "$project_root/rtl/design.v"
set_global_assignment -name TOP_LEVEL_ENTITY ${topModule}

# 3. Compiler Assignments
set_global_assignment -name NUM_PARALLEL_PROCESSORS ALL
set_global_assignment -name OPTIMIZATION_MODE "BALANCED"

# 4. Run Analysis & Elaboration (checks syntax, hierarchy & latches)
puts "======================================================================"
puts "Verilog Studio -> Running Analysis & Elaboration..."
puts "======================================================================"
if {[catch {execute_flow -analysis_and_elaboration} result]} {
    puts "Quartus Analysis & Elaboration encountered an error: $result"
    exit 1
}

puts "======================================================================"
puts "Verilog Studio -> Quartus Elaboration Completed Successfully!"
puts "Artifacts saved in: $prj_dir"
puts "======================================================================"
project_close
exit 0
`;
}
