const code = `
#include <iostream>
#include <string>

using namespace std;

int main() {
    string s = "Hello, world!";
    cout << s << endl;
    int a = 5;
    int b = 4;
    b++;
    return a - b;
}
`.trim();

module.exports = { code };
