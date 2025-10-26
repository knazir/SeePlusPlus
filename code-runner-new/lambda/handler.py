"""
AWS Lambda handler for C++ trace generation with Valgrind 3.27.0

This handler:
1. Receives C++ code via API Gateway or direct invocation
2. Compiles it with g++
3. Runs it under Valgrind to generate execution traces
4. Converts the trace to OPT visualization format
5. Returns the trace data
"""

import json
import os
import subprocess
import tempfile
import hashlib
import boto3
from pathlib import Path

# Initialize S3 client for caching (optional)
s3_client = boto3.client('s3')
CACHE_BUCKET = os.environ.get('CACHE_BUCKET', '')
ENABLE_CACHE = bool(CACHE_BUCKET)

# Paths (can be overridden by environment variables for testing)
VALGRIND_BIN = os.environ.get('VALGRIND_BIN', '/opt/valgrind/bin/vg-in-place')
VG_TO_OPT_SCRIPT = os.environ.get('VG_TO_OPT_SCRIPT', '/opt/vg_to_opt_trace.py')

def lambda_handler(event, context):
    """
    Lambda handler entry point

    Expected event format:
    {
        "code": "int main() { return 0; }",
        "preprocessed": false  # Optional: if true, skip #define union struct
    }

    Returns:
    {
        "success": true/false,
        "trace": {...}  # OPT trace format
        "ccStdout": "",
        "ccStderr": "",
        "stdout": "",
        "stderr": "",
        "error": ""  # Only present if success=false
    }
    """

    try:
        # Extract code from event
        if isinstance(event, str):
            event = json.loads(event)

        body = event.get('body', event)
        if isinstance(body, str):
            body = json.loads(body)

        code = body.get('code', '')
        if not code:
            return error_response('No code provided', 400)

        # Preprocess code (add union->struct define)
        if not body.get('preprocessed', False):
            code = '#define union struct\n' + code

        # Generate unique ID for this code
        unique_id = hashlib.sha256(code.encode()).hexdigest()[:16]

        # Check cache if enabled
        if ENABLE_CACHE:
            cached_result = check_cache(unique_id)
            if cached_result:
                print(f"Cache hit for {unique_id}")
                return success_response(cached_result)

        # Execute trace generation
        result = generate_trace(code, unique_id)

        # Cache result if enabled
        if ENABLE_CACHE and result['success']:
            cache_result(unique_id, result)

        return success_response(result)

    except Exception as e:
        print(f"Lambda handler error: {str(e)}")
        import traceback
        traceback.print_exc()
        return error_response(f"Internal error: {str(e)}", 500)


def generate_trace(code: str, unique_id: str) -> dict:
    """
    Generate execution trace for C++ code

    Returns:
    {
        "success": bool,
        "trace": dict or None,
        "ccStdout": str,
        "ccStderr": str,
        "stdout": str,
        "stderr": str,
        "error": str or None
    }
    """

    # Create temporary directory in /tmp (Lambda's writable space)
    with tempfile.TemporaryDirectory(dir='/tmp') as tmpdir:
        tmpdir_path = Path(tmpdir)

        # File paths
        cpp_file = tmpdir_path / f"{unique_id}.cpp"
        exe_file = tmpdir_path / unique_id
        vgtrace_file = tmpdir_path / f"{unique_id}.vgtrace"
        stdout_file = tmpdir_path / f"{unique_id}_stdout.txt"
        stderr_file = tmpdir_path / f"{unique_id}_stderr.txt"
        cc_stdout_file = tmpdir_path / f"{unique_id}_cc_stdout.txt"
        cc_stderr_file = tmpdir_path / f"{unique_id}_cc_stderr.txt"

        # Write code to file
        cpp_file.write_text(code)

        # Compile C++ code
        compile_cmd = [
            'g++',
            '-std=c++11',
            '-ggdb',
            '-O0',
            '-fno-omit-frame-pointer',
            str(cpp_file),
            '-o', str(exe_file)
        ]

        try:
            compile_result = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=30
            )

            cc_stdout = compile_result.stdout
            cc_stderr = compile_result.stderr

            cc_stdout_file.write_text(cc_stdout)
            cc_stderr_file.write_text(cc_stderr)

            if compile_result.returncode != 0:
                return {
                    'success': False,
                    'trace': None,
                    'ccStdout': cc_stdout,
                    'ccStderr': cc_stderr,
                    'stdout': '',
                    'stderr': '',
                    'error': 'Compilation failed'
                }

        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'trace': None,
                'ccStdout': '',
                'ccStderr': 'Compilation timeout (30s)',
                'stdout': '',
                'stderr': '',
                'error': 'Compilation timeout'
            }

        except Exception as e:
            return {
                'success': False,
                'trace': None,
                'ccStdout': '',
                'ccStderr': str(e),
                'stdout': '',
                'stderr': '',
                'error': f'Compilation error: {str(e)}'
            }

        # Run under Valgrind to generate trace
        valgrind_cmd = [
            VALGRIND_BIN,
            '--tool=memcheck',
            f'--source-filename={str(cpp_file)}',
            f'--trace-filename={str(vgtrace_file)}',
            '--read-var-info=yes',
            str(exe_file)
        ]

        try:
            valgrind_result = subprocess.run(
                valgrind_cmd,
                capture_output=True,
                text=True,
                timeout=120  # 2 minute timeout for execution
            )

            stdout = valgrind_result.stdout
            stderr = valgrind_result.stderr

            stdout_file.write_text(stdout)
            stderr_file.write_text(stderr)

        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'trace': None,
                'ccStdout': cc_stdout,
                'ccStderr': cc_stderr,
                'stdout': '',
                'stderr': 'Valgrind execution timeout (120s)',
                'error': 'Execution timeout'
            }

        except Exception as e:
            return {
                'success': False,
                'trace': None,
                'ccStdout': cc_stdout,
                'ccStderr': cc_stderr,
                'stdout': '',
                'stderr': str(e),
                'error': f'Valgrind error: {str(e)}'
            }

        # Check if vgtrace file was created
        if not vgtrace_file.exists():
            return {
                'success': False,
                'trace': None,
                'ccStdout': cc_stdout,
                'ccStderr': cc_stderr,
                'stdout': stdout,
                'stderr': stderr,
                'error': 'No trace file generated'
            }

        # Convert vgtrace to OPT format
        try:
            convert_cmd = [
                'python3',
                VG_TO_OPT_SCRIPT,
                '--create_jsvar=trace',
                str(tmpdir_path / unique_id)
            ]

            convert_result = subprocess.run(
                convert_cmd,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=str(tmpdir_path)
            )

            if convert_result.returncode != 0:
                return {
                    'success': False,
                    'trace': None,
                    'ccStdout': cc_stdout,
                    'ccStderr': cc_stderr,
                    'stdout': stdout,
                    'stderr': stderr,
                    'error': f'Trace conversion failed: {convert_result.stderr}'
                }

            # Parse the JavaScript variable output
            trace_output = convert_result.stdout.strip()

            # Remove 'var trace = ' prefix and trailing semicolon
            if trace_output.startswith('var trace = '):
                trace_json = trace_output[len('var trace = '):]
                # Remove trailing semicolon if present
                if trace_json.endswith(';'):
                    trace_json = trace_json[:-1]
                trace_json = trace_json.strip()
                trace_data = json.loads(trace_json)
            else:
                trace_data = json.loads(trace_output)

            return {
                'success': True,
                'trace': trace_data,
                'ccStdout': cc_stdout,
                'ccStderr': cc_stderr,
                'stdout': stdout,
                'stderr': stderr,
                'error': None
            }

        except Exception as e:
            return {
                'success': False,
                'trace': None,
                'ccStdout': cc_stdout,
                'ccStderr': cc_stderr,
                'stdout': stdout,
                'stderr': stderr,
                'error': f'Trace conversion error: {str(e)}'
            }


def check_cache(unique_id: str):
    """Check S3 cache for existing results"""
    if not ENABLE_CACHE:
        return None

    try:
        key = f"cache/{unique_id}/result.json"
        response = s3_client.get_object(Bucket=CACHE_BUCKET, Key=key)
        data = json.loads(response['Body'].read().decode('utf-8'))
        return data
    except s3_client.exceptions.NoSuchKey:
        return None
    except Exception as e:
        print(f"Cache check error: {str(e)}")
        return None


def cache_result(unique_id: str, result: dict):
    """Cache successful results to S3"""
    if not ENABLE_CACHE:
        return

    try:
        key = f"cache/{unique_id}/result.json"
        s3_client.put_object(
            Bucket=CACHE_BUCKET,
            Key=key,
            Body=json.dumps(result),
            ServerSideEncryption='aws:kms'
        )
        print(f"Cached result for {unique_id}")
    except Exception as e:
        print(f"Cache write error: {str(e)}")


def success_response(data: dict):
    """Format successful response"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(data)
    }


def error_response(message: str, status_code: int = 500):
    """Format error response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'success': False,
            'error': message
        })
    }
