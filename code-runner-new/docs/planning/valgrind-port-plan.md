# Valgrind Port Plan: SPP-Valgrind → Modern Valgrind 3.26.0

## Overview
This document outlines the incremental plan to port See++ modifications from the legacy SPP-Valgrind (based on older Valgrind) to the modern Valgrind 3.26.0 codebase.

## Modified Files Summary

### Files with SPP Modifications
1. `memcheck/mc_include.h` - Header modifications
2. `memcheck/mc_main.c` - Main memcheck logic
3. `memcheck/mc_translate.c` - Translation/instrumentation
4. `memcheck/mc_errors.c` - Error reporting
5. `include/pub_tool_debuginfo.h` - Public debug info API (includes inlined JSON library!)
6. `coregrind/m_debuginfo/debuginfo.c` - Debug info implementation
7. `coregrind/m_debuginfo/tytypes.c` - Type system handling
8. `coregrind/m_debuginfo/priv_tytypes.h` - Type system private header

## Key Modifications Categories

### 1. Trace Output Infrastructure
**Purpose**: Generate JSON trace output for See++ visualization

**Components**:
- External `trace_fp` file handle for writing trace
- `stdout_fd` for capturing program output
- Step counter (`n_steps`) with max limit (5000 steps)
- `pg_source_filename` global variable
- Trace output functions that write JSON

**Files Affected**:
- `mc_translate.c` - Instrumentation to capture execution steps
- `mc_main.c` - Trace file initialization/cleanup

### 2. Debug Information Enhancements
**Purpose**: Provide richer variable/type information for visualization

**Modifications**:
- Added `fullname` field to `DiVariable` and `GlobalBlock` structures (full variable names)
- New function: `pg_get_di_handle_at_ip(Addr ip)` - get debug handle at instruction pointer
- Custom type printing functions for JSON serialization
- Additional stack/global variable query functions

**Files Affected**:
- `include/pub_tool_debuginfo.h` - API additions
- `coregrind/m_debuginfo/debuginfo.c` - Implementation
- `coregrind/m_debuginfo/tytypes.c` - Type printing

### 3. Inlined JSON Library
**Purpose**: Serialize trace data to JSON format

**Details**:
- Entire json.h and json.c library inlined into `pub_tool_debuginfo.h`
- ~200+ lines of JSON handling code
- Used for formatting variable data, types, stack frames

**Files Affected**:
- `include/pub_tool_debuginfo.h` - Contains full JSON implementation

### 4. Memory Tracking Modifications
**Purpose**: Allow trace code to query memory state

**Modifications**:
- Made `is_mem_defined()` non-static and exported
- Moved `MC_ReadResult` enum to header
- Added `pg_source_filename` global

**Files Affected**:
- `mc_include.h` - Export declarations
- `mc_main.c` - Function visibility changes

### 5. Configuration Changes
**Purpose**: Optimize for tracing use case

**Changes**:
- Leak checking disabled by default (`LC_Off` instead of `LC_Summary`)
- Various includes added for file I/O, debug info access

**Files Affected**:
- `mc_main.c` - Default settings

### 6. Instrumentation Hooks
**Purpose**: Capture execution events for trace generation

**Modifications**:
- Additional IRDirty calls in translation phase
- Store/load instrumentation from Fjalar
- Step-by-step execution tracking

**Files Affected**:
- `mc_translate.c` - Core instrumentation logic

## Incremental Porting Phases

### Phase 1: Foundation & Headers (Current: Completed)
**Goal**: Build environment is working, Valgrind compiles and runs basic programs

**Status**: ✅ Complete (based on recent commits)
- Valgrind 3.26.0 baseline established
- Build system configured
- Basic functionality verified

### Phase 2: Debug Info Infrastructure
**Goal**: Port debug information enhancements without trace output

**Steps**:
1. Port `fullname` field additions to `DiVariable`/`GlobalBlock` structures
2. Add `pg_get_di_handle_at_ip()` function
3. Port custom type printing functions (without JSON dependency)
4. Test: Verify debug info can be queried for variables

**Files to Modify**:
- `include/pub_tool_debuginfo.h` - Add fullname fields and pg_get_di_handle_at_ip declaration
- `coregrind/m_debuginfo/debuginfo.c` - Implement fullname population and new functions
- `coregrind/m_debuginfo/priv_tytypes.h` - Add any needed type declarations
- `coregrind/m_debuginfo/tytypes.c` - Port type printing functions

**Compilation Check**: After each file, compile with `make` and fix errors
**Runtime Check**: Run simple test: `./vg-in-place --tool=memcheck code-runner-new/valgrind-tests/basic`

### Phase 3: JSON Library Integration
**Goal**: Add JSON serialization capability

**Steps**:
1. Extract JSON code from SPP-Valgrind's `pub_tool_debuginfo.h`
2. Consider: Keep inlined or create separate json.h/json.c?
3. Port JSON code with minimal changes
4. Test: Create small program that uses JSON functions

**Files to Modify**:
- `include/pub_tool_debuginfo.h` - Inline JSON library OR
- `coregrind/m_json/json.h` + `coregrind/m_json/json.c` - Separate module (cleaner)

**Decision Point**: Inline vs. separate module
- **Inline**: Matches original, simpler porting, but messy
- **Separate**: Cleaner architecture, easier to maintain

**Compilation Check**: Compile and verify JSON functions work in isolation
**Runtime Check**: Write small test that creates JSON objects

### Phase 4: Memcheck Header Modifications
**Goal**: Export necessary memcheck internals for tracing

**Steps**:
1. Add `pg_source_filename` global to `mc_include.h`
2. Move `MC_ReadResult` enum to header
3. Export `is_mem_defined()` function
4. Test: Verify memcheck still works normally

**Files to Modify**:
- `memcheck/mc_include.h` - Add declarations
- `memcheck/mc_main.c` - Remove static from is_mem_defined, add pg_source_filename

**Compilation Check**: Compile memcheck
**Runtime Check**: Run memcheck on simple program: `./vg-in-place --tool=memcheck code-runner-new/valgrind-tests/basic`

### Phase 5: Trace File Infrastructure
**Goal**: Add trace file creation/management without full instrumentation

**Steps**:
1. Add `trace_fp` and `stdout_fd` globals
2. Add trace file open/close logic in mc_main.c
3. Add `n_steps` counter and MAX_STEPS limit
4. Add basic JSON trace structure output (header/footer)
5. Test: Verify trace file is created and contains valid JSON skeleton

**Files to Modify**:
- `memcheck/mc_main.c` - Add trace file management, step counter
- `memcheck/mc_translate.c` - Declare extern variables

**API Compatibility Notes**:
- Check if VgFile API changed between versions
- Verify VG_(fopen), VG_(fprintf), VG_(fclose) still exist
- Update to new APIs if needed

**Compilation Check**: Compile memcheck
**Runtime Check**: Run and verify trace.json file is created

### Phase 6: Basic Instrumentation
**Goal**: Add step-by-step execution tracking without full variable tracking

**Steps**:
1. Port IRDirty additions from mc_translate.c
2. Add callback functions for execution steps
3. Output line number changes to trace
4. Test: Verify each line execution is captured

**Files to Modify**:
- `memcheck/mc_translate.c` - Add instrumentation hooks
- `memcheck/mc_main.c` - Add callback implementations

**Compilation Check**: Compile and check for IR errors
**Runtime Check**: Run simple program and verify line numbers in trace:
  `./vg-in-place --tool=memcheck code-runner-new/valgrind-tests/basic`

### Phase 7: Variable Tracking
**Goal**: Add full variable state tracking to trace output

**Steps**:
1. Port stack variable query logic
2. Port global variable query logic
3. Port heap variable tracking
4. Integrate type information with JSON output
5. Test: Verify variables appear in trace with correct values/types

**Files to Modify**:
- `memcheck/mc_translate.c` - Variable query calls
- `coregrind/m_debuginfo/debuginfo.c` - Complete variable tracking functions
- `coregrind/m_debuginfo/tytypes.c` - Type formatting for JSON

**Runtime Check**: Run test with variables:
  `./vg-in-place --tool=memcheck code-runner-new/valgrind-tests/fjalar-IntTest`

### Phase 8: Memory State Tracking
**Goal**: Track memory defined/undefined state for variables

**Steps**:
1. Port `is_mem_defined()` usage in trace generation
2. Add memory state to variable output
3. Track pointer targets and validity
4. Test: Verify memory states in trace

**Files to Modify**:
- `memcheck/mc_translate.c` - Memory state queries

**Runtime Check**: Run pointer test:
  `./vg-in-place --tool=memcheck code-runner-new/valgrind-tests/fjalar-PointerTest`

### Phase 9: Full Feature Testing
**Goal**: Verify all test cases pass

**Steps**:
1. Run full test suite in `code-runner-new/valgrind-tests/`
2. Compare output with `.golden` files
3. Fix discrepancies
4. Document any intentional differences

**Test Script**:
```bash
cd code-runner-new/valgrind-tests
python3 run_test_from_scratch.py
```

### Phase 10: Integration & Optimization
**Goal**: Integrate with See++ backend, optimize performance

**Steps**:
1. Test with backend API
2. Profile and optimize trace generation
3. Handle edge cases (crashes, exceptions, infinite loops)
4. Add error handling
5. Documentation updates

## API Compatibility Concerns

### Known Changes Between Valgrind Versions
1. **VEX IR**: IR structures may have changed
2. **Debug Info API**: DWARF parsing may have improved
3. **File I/O**: VgFile API may have changed
4. **Memory Management**: Allocation APIs may differ

### Verification Strategy
At each phase, check:
1. Compilation succeeds
2. Simple programs run without crashes
3. Memcheck detects memory errors correctly
4. New functionality works as expected

## Testing Strategy

### Level 1: Compilation
- After each file modification, run `make`
- Fix compilation errors immediately
- Don't proceed until clean compile

### Level 2: Basic Functionality
- Run valgrind on trivial C program
- Verify no crashes
- Check memcheck still catches errors

### Level 3: Trace Output
- Run on basic.c test
- Verify trace.json is created
- Validate JSON syntax
- Check content structure

### Level 4: Test Suite
- Run individual test files from valgrind-tests/
- Compare with .golden files
- Fix issues one test at a time

### Level 5: Full Suite
- Run golden_test.py or run_test_from_scratch.py
- Achieve passing results on all tests

## Risk Areas

### High Risk
1. **VEX IR Changes**: Translation may break if IR structures changed significantly
2. **Debug Info Changes**: DWARF parsing code may be completely rewritten
3. **JSON Library**: Old inlined code may not work with new Valgrind

### Medium Risk
1. **File I/O API**: VgFile functions may have changed signatures
2. **Memory API**: Allocation functions may differ
3. **Type System**: Type representation may have evolved

### Low Risk
1. **Header includes**: May need to update include paths
2. **Function signatures**: May need minor adjustments
3. **Configuration defaults**: Easy to port

## Rollback Plan

If a phase fails catastrophically:
1. Git commit before starting each phase
2. Use `git reset --hard` to rollback
3. Document what failed
4. Re-evaluate approach

## Success Criteria

### Minimum Viable Port
- Compiles without errors
- Runs basic C programs
- Generates trace.json with valid JSON
- Captures line numbers and basic variable info

### Full Success
- All tests in valgrind-tests/ pass
- Trace output matches expected format
- Backend integration works
- Performance acceptable (< 2x slowdown from old version)

## Next Steps

1. ✅ Phase 1 complete
2. ⏭️ Begin Phase 2: Debug Info Infrastructure
3. Create branch: `valgrind-port-phase-2`
4. Commit after each successful file port

## Notes

- Keep commits small and incremental
- Test after every change
- Document API differences discovered
- Update this plan as needed
