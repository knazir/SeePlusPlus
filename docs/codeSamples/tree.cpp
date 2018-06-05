#include <iostream>
#include <string>

using namespace std;

typedef struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
} TreeNode;

TreeNode *root = nullptr;

int main() {
    cout << "yay trees!" << endl;
    root = new TreeNode;
    root->val = 4;
    root->left = new TreeNode;
    root->left->val = 5;
    root->right = new TreeNode;
    root->right->val = 6;
    root->right->right = nullptr;
    root->right->left = nullptr;
    root->left->right = nullptr;
    root->left->left = nullptr;
    
    return 0;
}
