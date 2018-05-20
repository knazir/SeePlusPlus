# Run the Valgrind-based C/C++ backend for OPT and produce JSON to
# stdout for piping to a web app, properly handling errors and stuff
#
# Created: 2016-05-09
# Modified: 2018-04-14

import json
import os
import re
import shutil
import sys

from cgi import parse_qs, escape
from subprocess import Popen, PIPE
from tempfile import mkdtemp


def pluck(d, *args):
    return (d[arg] for arg in args)


def parse_request(env):
    return parse_qs(env['QUERY_STRING'])


def preprocess_code(code):
    return "#define union struct\n" + code


def setup_options(env):
    request_info = parse_request(env)
    opts = {
        'VALGRIND_MSG_RE': re.compile('==\d+== (.*)$'),
        'PROGRAM_DIR': mkdtemp(prefix='/var/spp/programs/'),
        'LIB_DIR': '/var/spp/lib',
        'USER_PROGRAM': preprocess_code(request_info['code'][0]),
        'LANG': request_info['lang'][0],
        'PRETTY_DUMP': False
    }
    if opts['LANG'] == 'c':
        opts['CC'] = 'gcc'
        opts['DIALECT'] = '-std=c11'
        opts['FN'] = 'usercode.c'
    elif opts['LANG'] == 'c++':
        opts['CC'] = 'g++'
        opts['DIALECT'] = '-std=c++11'
        opts['FN'] = 'usercode.cpp'
    opts.update({
        'F_PATH': os.path.join(opts['PROGRAM_DIR'], opts['FN']),
        'VGTRACE_PATH': os.path.join(opts['PROGRAM_DIR'], 'usercode.vgtrace'),
        'EXE_PATH': os.path.join(opts['PROGRAM_DIR'], 'usercode.exe')
    })
    return opts


def prep_dir(opts):
    with open(opts['F_PATH'], 'w') as f:
        f.write(opts['USER_PROGRAM'])


def compile(opts):
    CC, DIALECT, EXE_PATH, F_PATH = pluck(opts, 'CC', 'DIALECT', 'EXE_PATH', 'F_PATH')
    p = Popen(
        [CC, DIALECT, '-ggdb', '-O0', '-fno-omit-frame-pointer', '-o', EXE_PATH, F_PATH],
        stdout=PIPE,
        stderr=PIPE
    )
    (gcc_stdout, gcc_stderr) = p.communicate()
    gcc_retcode = p.returncode
    return gcc_retcode, gcc_stdout, gcc_stderr


def check_for_valgrind_errors(opts, valgrind_stderr):
    error_lines = []
    in_error_msg = False
    for line in valgrind_stderr.splitlines():
        m = opts['VALGRIND_MSG_RE'].match(line)
        if m:
            msg = m.group(1).rstrip()
            if 'Process terminating' in msg:
                in_error_msg = True
            if in_error_msg and not msg:
                in_error_msg = False
            if in_error_msg:
                error_lines.append(msg)
    return '\n'.join(error_lines) if error_lines else None


def run_valgrind(opts):
    VALGRIND_EXE = os.path.join(opts['LIB_DIR'], 'valgrind-3.11.0/inst/bin/valgrind')
    valgrind_p = Popen(
        ['stdbuf', '-o0',  # VERY IMPORTANT to disable stdout buffering so that stdout is traced properly
         VALGRIND_EXE,
         '--tool=memcheck',
         '--source-filename=' + opts['FN'],
         '--trace-filename=' + opts['VGTRACE_PATH'],
         opts['EXE_PATH']
         ],
        stdout=PIPE,
        stderr=PIPE
    )
    (valgrind_stdout, valgrind_stderr) = valgrind_p.communicate()
    valgrind_retcode = valgrind_p.returncode
    valgrind_out = '\n'.join(['=== Valgrind stdout ===', valgrind_stdout, '=== Valgrind stderr ===', valgrind_stderr])
    end_of_trace_error_msg = check_for_valgrind_errors(opts, valgrind_stderr) if valgrind_retcode != 0 else None
    return valgrind_out, end_of_trace_error_msg


def get_opt_trace_from_vg_trace(opts, end_of_trace_error_msg):
    POSTPROCESS_EXE = os.path.join(opts['LIB_DIR'], 'vg_to_opt_trace.py')
    args = ['python', POSTPROCESS_EXE, '--prettydump' if opts['PRETTY_DUMP'] else '--jsondump']
    if end_of_trace_error_msg:
        args += ['--end-of-trace-error-msg', end_of_trace_error_msg]
    args.append(opts['F_PATH'])
    postprocess_p = Popen(args, stdout=PIPE, stderr=PIPE)
    (postprocess_stdout, postprocess_stderr) = postprocess_p.communicate()
    postprocess_stderr = '\n'.join(['=== postprocess stderr ===', postprocess_stderr, '==='])
    return postprocess_stdout, postprocess_stderr


def generate_trace(opts, gcc_stderr):
    gcc_stderr = '\n'.join(['=== gcc stderr ===', gcc_stderr, '==='])
    (valgrind_out, end_of_trace_error_msg) = run_valgrind(opts)
    (postprocess_stdout, postprocess_stderr) = get_opt_trace_from_vg_trace(opts, end_of_trace_error_msg)
    std_err = '\n'.join([gcc_stderr, valgrind_out, postprocess_stderr])
    return std_err, postprocess_stdout


def handle_gcc_error(opts, gcc_stderr):
    stderr = '\n'.join(['=== gcc stderr ===', gcc_stderr, '==='])

    exception_msg = 'unknown compiler error'
    lineno = None
    column = None

    # just report the FIRST line where you can detect a line and column
    # number of the error.
    for line in gcc_stderr.splitlines():
        # can be 'fatal error:' or 'error:' or probably other stuff too.
        m = re.search(opts['FN'] + ':(\d+):(\d+):.+?(error:.*$)', line)
        if m:
            lineno = int(m.group(1))
            column = int(m.group(2))
            exception_msg = m.group(3).strip()
            break

        # linker errors are usually 'undefined ' something
        # (this code is VERY brittle)
        if 'undefined ' in line:
            parts = line.split(':')
            exception_msg = parts[-1].strip()
            # match something like
            # /home/pgbovine/opt-cpp-backend/./usercode.c:2: undefined reference to `asdf'
            if opts['FN'] in parts[0]:
                try:
                    lineno = int(parts[1])
                except:
                    pass
            break

    ret = {'code': opts['USER_PROGRAM'],
           'trace': [
               {'event': 'uncaught_exception',
                'exception_msg': exception_msg,
                'line': lineno
                }
           ]}

    return stderr, json.dumps(ret)


def cleanup(opts):
    shutil.rmtree(opts['PROGRAM_DIR'])


def application(env, start_response):
    opts = setup_options(env)
    prep_dir(opts)
    (gcc_retcode, gcc_stdout, gcc_stderr) = compile(opts)
    (stderr, stdout) = generate_trace(opts, gcc_stderr) if gcc_retcode == 0 else handle_gcc_error(opts, gcc_stderr)
    cleanup(opts)
    start_response('200 OK', [('Content-type', 'application/json')])
    # TODO: Figure out how to handle stderr
    return [stdout]
