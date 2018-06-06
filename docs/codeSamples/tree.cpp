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
    root->right->right = new TreeNode{7, nullptr, nullptr};
    root->right->left = new TreeNode{8, nullptr, nullptr};
    root->left->right = new TreeNode{9, nullptr, nullptr};
    root->left->left = new TreeNode{10, nullptr, nullptr};
    
    return 0;
}
