#include <iostream>
#include <string>

using namespace std;

typedef struct TrieNode {
    TrieNode *elems[4];
} TrieNode;

TrieNode *root = nullptr;

int main() {
    cout << "yay tries!" << endl;
    root = new TrieNode;
    for (int i = 0; i < 4; i++) {
        TrieNode *newNode = new TrieNode;
        for (int i = 0; i < 4; i++) {
        	newNode->elems[i] = nullptr;
        }
        root->elems[i] = newNode;
    }
    
    return 0;
}
