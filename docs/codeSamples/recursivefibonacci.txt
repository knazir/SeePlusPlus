// really bad fibonacci implementation for the sake of testing 
// recursion/params/returns
int fib(int a) {
    int answer;
	if (a == 0 || a == 1) {
        answer = 0;
    } else {
        answer = a * fib(a - 1);
    }
    return answer; 
}

int main() {
    int answer = fib(4);
    return 0;
}
