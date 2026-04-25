import { Modal } from './Modal';
import { useAppStore } from '../store';
import { kbd } from '../platform/kbd';
import { track } from '../analytics';

interface Example {
  id: string;
  category: string;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3;
  stepsEstimate: string;
  code: string;
}

// Every program below MUST include <iostream> + a cout statement as the first
// line of main(). Without this priming call, SPP-Valgrind's stack walker
// doesn't initialize and the backend returns an empty trace. See
// backend/CLAUDE.md for the full quirk note.
const EXAMPLES: Example[] = [
  {
    id: 'll-reverse',
    category: 'Pointers & dynamic memory',
    title: 'Linked list · build & reverse',
    description:
      'Allocate nodes, chain them, reverse in place. See heap relayout shine.',
    difficulty: 2,
    stepsEstimate: '~22 steps',
    code: `#include <iostream>
using namespace std;

struct Node {
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
    cout << "linked list demo" << endl;
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
    id: 'fact-rec',
    category: 'Stack & recursion',
    title: 'Recursive factorial',
    description:
      'Deep stack growth and collapse — the classic recursion visualization.',
    difficulty: 1,
    stepsEstimate: '~14 steps',
    code: `#include <iostream>
using namespace std;

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    cout << "factorial" << endl;
    int result = factorial(5);
    return result == 120 ? 0 : 1;
}
`,
  },
  {
    id: 'hello',
    category: 'Basics',
    title: 'Hello, world',
    description: 'Simplest possible program. Good first trace to get oriented.',
    difficulty: 1,
    stepsEstimate: '~3 steps',
    code: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, world!" << endl;
    return 0;
}
`,
  },
  {
    id: 'ptr-swap',
    category: 'Pointers',
    title: 'Pointer swap & aliasing',
    description: 'Two pointers to one int; aliasing makes both values appear to change.',
    difficulty: 1,
    stepsEstimate: '~8 steps',
    code: `#include <iostream>
using namespace std;

void swap(int* a, int* b) {
    int tmp = *a;
    *a = *b;
    *b = tmp;
}

int main() {
    cout << "pointer swap" << endl;
    int x = 7;
    int y = 13;
    swap(&x, &y);
    return 0;
}
`,
  },
  {
    id: 'bst-insert',
    category: 'Recursion & trees',
    title: 'Binary search tree insertion',
    description:
      'Recursively insert 5 values into an empty BST; watch the tree grow by height.',
    difficulty: 3,
    stepsEstimate: '~35 steps',
    code: `#include <iostream>
using namespace std;

struct Node {
    int v;
    Node* l;
    Node* r;
};

Node* insert(Node* root, int v) {
    if (!root) return new Node{v, nullptr, nullptr};
    if (v < root->v) root->l = insert(root->l, v);
    else root->r = insert(root->r, v);
    return root;
}

int main() {
    cout << "bst insert" << endl;
    Node* root = nullptr;
    root = insert(root, 4);
    root = insert(root, 2);
    root = insert(root, 6);
    root = insert(root, 1);
    root = insert(root, 3);
    return 0;
}
`,
  },
  {
    id: 'arr-dyn',
    category: 'Heap arrays',
    title: 'Dynamic array (new int[])',
    description: 'Heap allocations with indexed cells; allocated once, freed at end.',
    difficulty: 2,
    stepsEstimate: '~12 steps',
    code: `#include <iostream>
using namespace std;

int main() {
    cout << "dynamic array" << endl;
    int n = 4;
    int* a = new int[n];
    for (int i = 0; i < n; i++) a[i] = i * i;
    int sum = 0;
    for (int i = 0; i < n; i++) sum += a[i];
    delete[] a;
    return sum;
}
`,
  },
];

export function ExamplesModal() {
  const close = useAppStore((s) => s.closeModal);
  const setCode = useAppStore((s) => s.setCode);
  const currentCode = useAppStore((s) => s.code);

  const pick = (ex: Example) => {
    track('example_loaded', { example_id: ex.id });
    setCode(ex.code);
    close();
  };

  return (
    <Modal title="Examples" onClose={close} data-testid="examples-modal" size="lg">
      <p className="mb-4 font-mono text-[11px] text-ink-3">
        Browse · load · fork. Picking an example replaces the current editor contents.
      </p>
      <ul
        className="grid grid-cols-1 gap-2.5 md:grid-cols-2"
        data-testid="examples-list"
      >
        {EXAMPLES.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              onClick={() => pick(ex)}
              data-featured={currentCode === ex.code || undefined}
              data-testid={`example-${ex.id}`}
              className="flex h-full w-full flex-col gap-1.5 rounded-[4px] border border-line-soft bg-bg-0 p-3 text-left transition-all duration-fast ease-out-soft hover:border-accent-line hover:bg-accent-soft data-[featured]:border-accent data-[featured]:bg-accent-soft"
            >
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-3">
                {ex.category}
              </span>
              <span className="font-mono text-[13px] text-ink-0">{ex.title}</span>
              <span className="font-mono text-[11px] leading-snug text-ink-2">
                {ex.description}
              </span>
              <span className="mt-auto flex items-center justify-between pt-1 font-mono text-[10px] text-ink-3">
                <DifficultyDots level={ex.difficulty} />
                <span>{ex.stepsEstimate}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[11px] text-ink-3">
        Tip: <span className="text-ink-1">{kbd('K')}</span> opens this modal from anywhere.
      </p>
    </Modal>
  );
}

function DifficultyDots({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="tracking-[0.2em]" aria-label={`difficulty ${level} of 3`}>
      <span className="text-accent">●</span>
      <span className={level >= 2 ? 'text-accent' : 'text-line'}>●</span>
      <span className={level >= 3 ? 'text-accent' : 'text-line'}>●</span>
    </span>
  );
}
