const code = `
int a = 32;

void foo() {
    int number = 42;
    char letter = 'c';
    double decimal = 2.5;
    long sum = number + (int)letter;
    bool value = true;
}

int main() {
    int x = 3;
    char *y = "hello";
    foo();
    return 0;
}
`.trim();

module.exports = { code };
