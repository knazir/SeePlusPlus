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
VALGRIND_BIN = os.environ.get('VALGRIND_BIN', '/opt/valgrind/bin/valgrind')

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
        # NOTE: source-filename must be just the basename, not full path
        # because DWARF debug info stores only the basename
        #
        # IMPORTANT: Valgrind's custom code reads stdout by rewinding and reading
        # from file descriptor 1 (stdout). We redirect the program's stdout to a file
        # so that Valgrind's custom trace code can rewind and read from FD 1.
        #
        # The approach:
        # 1. Create a temp file for the program's stdout
        # 2. Redirect stdout (FD 1) to this file using shell redirection
        # 3. Use stdbuf -o0 to disable buffering so Valgrind can read immediately
        # 4. Valgrind's mc_translate.c will lseek(stdout_fd, 0, SEEK_SET) and read from FD 1

        # Create a temp file for the program's stdout
        program_stdout_file = tmpdir_path / f"{unique_id}_program_stdout.txt"

        # Build the command with shell redirection
        # Important: Only redirect stdout (>), not stderr (2>&1)
        # Valgrind's diagnostics go to stderr, program output goes to stdout
        valgrind_cmd_str = f"""stdbuf -o0 {VALGRIND_BIN} \\
            --tool=memcheck \\
            --source-filename={cpp_file.name} \\
            --trace-filename={str(vgtrace_file)} \\
            --read-var-info=yes \\
            {str(exe_file)} \\
            > {str(program_stdout_file)}"""

        try:
            valgrind_result = subprocess.run(
                valgrind_cmd_str,
                shell=True,
                capture_output=True,
                text=True,
                timeout=120,  # 2 minute timeout for execution
                cwd=str(tmpdir_path)  # Run in temp directory
            )

            # Valgrind's stderr contains its diagnostic messages
            # Valgrind's stdout should be empty (program stdout went to file)
            valgrind_stderr = valgrind_result.stderr

            # Read the program's actual stdout from the file
            if program_stdout_file.exists():
                program_stdout = program_stdout_file.read_text()
            else:
                program_stdout = ''

            # Store outputs
            stdout_file.write_text(program_stdout)
            stderr_file.write_text(valgrind_stderr)

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
                'traceContent': '',
                'ccStdout': cc_stdout,
                'ccStderr': cc_stderr,
                'stdout': program_stdout,
                'stderr': valgrind_stderr,
                'error': 'No trace file generated'
            }

        # Read the raw vgtrace file (backend will parse it)
        try:
            trace_content = vgtrace_file.read_text()

            return {
                'success': True,
                'traceContent': trace_content,
                'ccStdout': cc_stdout,
                'ccStderr': cc_stderr,
                'stdout': program_stdout,
                'stderr': valgrind_stderr,
                'error': None
            }

        except Exception as e:
            return {
                'success': False,
                'trace': None,
                'ccStdout': cc_stdout,
                'ccStderr': cc_stderr,
                'stdout': program_stdout,
                'stderr': valgrind_stderr,
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
