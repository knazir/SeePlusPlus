import { Modal } from './Modal';
import { useAppStore } from '../store';

// Canned examples for the Examples modal. Kept small; add more when users
// ask or when we have real content to demo.
interface Example {
  id: string;
  title: string;
  summary: string;
  code: string;
}

const EXAMPLES: Example[] = [
  {
    id: 'hello',
    title: 'Hello, world',
    summary: 'Simplest possible program.',
    code: `#include <iostream>

int main() {
    std::cout << "Hello, world!" << std::endl;
    return 0;
}
`,
  },
  {
    id: 'll',
    title: 'Linked list build + reverse',
    summary: 'Push three nodes, reverse in place.',
    code: `struct Node {
    int value;
    Node* next;
};

Node* push_front(Node* head, int v) {
    Node* n = new Node{v, head};
    return n;
}

Node* reverse(Node* head) {
    Node* prev = nullptr;
    Node* curr = head;
    while (curr != nullptr) {
        Node* next = curr->next;
        curr->next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}

int main() {
    Node* list = nullptr;
    list = push_front(list, 1);
    list = push_front(list, 2);
    list = push_front(list, 3);
    list = reverse(list);
    return 0;
}
`,
  },
  {
    id: 'fact',
    title: 'Recursive factorial',
    summary: 'Classic recursion to observe the growing stack.',
    code: `int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    int result = factorial(5);
    return result == 120 ? 0 : 1;
}
`,
  },
];

export function ExamplesModal() {
  const close = useAppStore((s) => s.closeModal);
  const setCode = useAppStore((s) => s.setCode);

  const pick = (ex: Example) => {
    setCode(ex.code);
    close();
  };

  return (
    <Modal title="Examples" onClose={close} data-testid="examples-modal">
      <ul className="flex flex-col gap-2" data-testid="examples-list">
        {EXAMPLES.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              onClick={() => pick(ex)}
              data-testid={`example-${ex.id}`}
              className="flex w-full flex-col items-start gap-0.5 rounded border border-line-soft bg-bg-0 px-3 py-2 text-left transition-colors duration-fast ease-out-soft hover:border-accent-line hover:bg-accent-soft"
            >
              <span className="font-mono text-sm text-ink-0">{ex.title}</span>
              <span className="font-mono text-[11px] text-ink-2">{ex.summary}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[11px] text-ink-3">
        Tip: <span className="text-ink-1">⌘K</span> opens this modal from anywhere.
      </p>
    </Modal>
  );
}
