#include <iostream>

using namespace std;

typedef struct Node {
    int value;
    char arr[3];
} Node;

void changeNode(Node node) {
    int newValue = node.value / 2;
    node.value = newValue;
    char *toChange = &node.arr[2];
    *toChange = '8';
    cout << "Changed value: " << node.value << endl;
}

int main() {
    int *n = new int;
    *n = 42;
    double decimal = 2.5;
    double *decimalPtr = nullptr;
    decimalPtr = &decimal;
    Node node;
    node.value = *n;
    node.arr[0] = '1';
    node.arr[1] = '9';
    node.arr[2] = '4';
    changeNode(node);
    cout << "Final value: " << node.value << endl;
    return 0;
}
