const code = `
int a = 32;

struct lastThing {
    double d;
};

struct otherThing {
    char ch;
    struct lastThing lastStruct;
};

struct thing {
    int b;
    bool p;
    struct otherThing otherStruct;
};

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
    struct lastThing myLastThing = {1.5};
    struct otherThing myOtherThing = {'c', myLastThing};
    struct thing myThing = {2, true, myOtherThing};
    return 0;
}
`.trim();

module.exports = { code };
