#!/usr/bin/env python3
"""
Simple test of the Lambda handler logic without Docker/Lambda runtime
Tests the core trace generation functionality
"""

import json
import sys
import os

# Add lambda directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Mock environment
os.environ['CACHE_BUCKET'] = ''  # Disable caching for test

# Import handler
from handler import generate_trace

def test_simple_code():
    """Test with simple C++ code"""
    code = """
int main() {
    int x = 42;
    return 0;
}
"""

    print("Testing simple C++ code...")
    print(f"Code:\n{code}")
    print("\n" + "="*50 + "\n")

    result = generate_trace(code, "test-simple")

    print("Result:")
    print(json.dumps(result, indent=2))

    if result['success']:
        print("\n✓ Test PASSED - Trace generated successfully")
        if result['trace']:
            trace_steps = len(result['trace'].get('trace', []))
            print(f"  Generated {trace_steps} execution steps")
        return True
    else:
        print("\n✗ Test FAILED")
        print(f"  Error: {result.get('error', 'Unknown')}")
        return False

def test_with_variables():
    """Test with multiple variables"""
    code = """
#include <stdio.h>

int main() {
    int x = 10;
    int y = 20;
    int z = x + y;
    printf("Result: %d\\n", z);
    return 0;
}
"""

    print("\n" + "="*50)
    print("Testing C++ code with variables...")
    print(f"Code:\n{code}")
    print("\n" + "="*50 + "\n")

    result = generate_trace(code, "test-variables")

    print("Result:")
    print(json.dumps(result, indent=2))

    if result['success']:
        print("\n✓ Test PASSED - Trace with variables generated")
        if result['trace']:
            trace_steps = len(result['trace'].get('trace', []))
            print(f"  Generated {trace_steps} execution steps")

            # Check if first step has variables
            if trace_steps > 0:
                first_step = result['trace']['trace'][0]
                locals_dict = first_step.get('stack_to_render', [{}])[0].get('encoded_locals', {})
                print(f"  Found {len(locals_dict)} local variables in first step")
        return True
    else:
        print("\n✗ Test FAILED")
        print(f"  Error: {result.get('error', 'Unknown')}")
        return False

if __name__ == '__main__':
    print("="*50)
    print("Lambda Handler Test Suite")
    print("="*50)
    print("")

    tests = [
        ("Simple Code", test_simple_code),
        ("Variables", test_with_variables),
    ]

    passed = 0
    failed = 0

    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"\n✗ Test {name} CRASHED: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "="*50)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("="*50)

    sys.exit(0 if failed == 0 else 1)
