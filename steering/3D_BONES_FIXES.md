# 3D Bone Debugging & Attachment — Detailed Design

> **Goal:** Make it trivial to inspect GLTF skeleton hierarchies at runtime and attach models to bones with correct positioning — no guesswork, minimal magic numbers.
> **Outcome:** `qdbg bones PlayerCharacter` dumps the full bone tree with world positions; `BoneAttachment` provides a declarative, scene-tree-visible way to attach equipment to skeleton joints. The 3D dungeon sword is correctly positioned on the player's hand.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | `qdbg bones` and `qdbg bone-info` commands | Done |
| 2 | `BoneAttachment` engine primitive | Done |
| 3 | Fix sword attachment in 3D dungeon | Done |

---

## Asset Analysis: Kenney Mini-Dungeon Models

Understanding the models is essential context for this design.

### Character (`character-human.glb`)

7-bone skeleton with skinned meshes. **Bone hierarchy:**

```
character-human (scene root)
  root [0, 0, 0]
    leg-left  [0.084, 0.176, -0.024]
    leg-right [-0.084, 0.176, -0.024]
    torso     [0, 0.176, -0.024]
      arm-left  [0.100, 0.112, 0.012]   ← shoulder, NOT hand
      arm-right [-0.100, 0.112, 0.012]  ← shoulder, NOT hand
      head      [0, 0.167, 0.026]
```

**Critical detail:** `arm-right` is a **leaf bone at the shoulder**. There is no `hand-right` bone. The hand position must be estimated by offsetting along the bone's local axis. Arm length is ~0.15 units.

32 animations including: `holding-right` (arm posed outward for carrying), `attack-melee-right` (swing), `walk`, `idle`.

### Sword (`weapon-sword.glb`)

**Single mesh, no bones, no skeleton, no animations.** Origin is at the crossguard/grip junction:

```
        ↑ blade (+Y, 0.348 units)
        |
  ──────┼──────  crossguard (origin Y=0)
        |
        ↓ handle (-Y, 0.10 units)
```

This is well-designed — the origin IS the grip point. If we place it at the hand, the sword orients correctly with blade extending along +Y.

### Implication for API Design

With these Kenney models, **one offset is unavoidable**: the shoulder-to-hand distance (~0.15 units along bone-local -Y). This is a property of the character rig, not the weapon. Models with dedicated `hand-right` bones (common in higher-fidelity rigs) would need zero offset.

The API should make this single offset obvious and discoverable, not buried in magic numbers.

---

## Phase 1: qdbg Bone Inspection Commands

Add two new qdbg commands that expose the Three.js Object3D hierarchy of GLTF models, focusing on skeleton bones and their world-space transforms.

- [ ] Add `cmd_bones()` to `bin/qdbg`
- [ ] Add `cmd_bone_info()` to `bin/qdbg`
- [ ] Register both in the dispatch case statement
- [ ] Update help text in `show_usage()`

### `qdbg bones <node>`

Dumps the full Object3D tree of a GLTFModel node, highlighting bones and their transforms.

**Implementation in `bin/qdbg`:**

The node-finding logic reuses the existing `__quintusDebug.inspect()` bridge method to get the node ID, then accesses the live node via `__quintusGame` for Three.js internals. This avoids reimplementing tree traversal and uses the public `children` accessor (not the private `_children` field).

```bash
cmd_bones() {
  local target="${1:?Usage: qdbg bones <name|id>}"
  local safe_target="${target//\'/\\\'}"
  need_bridge
  qblock "
    var d = window.__quintusDebug;
    var snap = d.inspect('${safe_target}');
    if (!snap) snap = d.inspect(Number('${safe_target}'));
    if (!snap) return 'Node not found: ${safe_target}';

    // Find the live node by ID via game scene tree
    var game = window.__quintusGame;
    var node = null;
    var stack = [game.currentScene];
    while (stack.length > 0) {
      var n = stack.pop();
      if (n.id === snap.id) { node = n; break; }
      var ch = n.children;
      for (var i = 0; i < ch.length; i++) stack.push(ch[i]);
    }
    if (!node || !node.object3d) return 'Node has no object3d';

    node.object3d.updateMatrixWorld(true);

    var lines = [];
    function walk(obj, depth) {
      var indent = '';
      for (var i = 0; i < depth; i++) indent += '  ';

      var isBone = obj.isBone || false;
      var type = isBone ? 'Bone' : obj.type || obj.constructor.name;
      var label = (obj.name || '(unnamed)') + ' [' + type + ']';
      if (isBone) label = '* ' + label;

      var p = obj.position;
      var wm = obj.matrixWorld.elements;
      var wp = { x: wm[12], y: wm[13], z: wm[14] };

      var info = 'local(' + p.x.toFixed(3) + ', ' + p.y.toFixed(3) + ', ' + p.z.toFixed(3) + ')';
      info += '  world(' + wp.x.toFixed(3) + ', ' + wp.y.toFixed(3) + ', ' + wp.z.toFixed(3) + ')';

      if (obj.children.length > 0) {
        info += '  children=' + obj.children.length;
      }

      lines.push(indent + label + '  ' + info);

      for (var c = 0; c < obj.children.length; c++) {
        walk(obj.children[c], depth + 1);
      }
    }
    walk(node.object3d, 0);
    return lines.join('\\n');
  "
}
```

**Example output:**

```
(unnamed) [Object3D]  local(1.000, 0.000, 3.000)  world(1.000, 0.000, 3.000)  children=1
  character-human [Object3D]  local(0.000, 0.000, 0.000)  world(1.000, 0.000, 3.000)  children=2
    * root [Bone]  local(0.000, 0.000, 0.000)  world(1.000, 0.000, 3.000)  children=1
      * torso [Bone]  local(0.000, 0.176, -0.024)  world(1.000, 0.176, 2.976)  children=3
        * head [Bone]  local(0.000, 0.167, 0.026)  world(1.000, 0.343, 3.002)
        * arm-left [Bone]  local(0.100, 0.112, 0.012)  world(1.100, 0.288, 2.988)
        * arm-right [Bone]  local(-0.100, 0.112, 0.012)  world(0.900, 0.288, 2.988)
    body-mesh [SkinnedMesh]  local(0.000, 0.000, 0.000)  world(1.000, 0.000, 3.000)
    head-mesh [SkinnedMesh]  local(0.000, 0.000, 0.000)  world(1.000, 0.000, 3.000)
```

### `qdbg bone-info <node> <bone>`

Detailed transform dump for a single bone — local position, world position, quaternion, rotation, scale, parent name, and child list. Uses the same `inspect()` → find-by-ID pattern.

```bash
cmd_bone_info() {
  local target="${1:?Usage: qdbg bone-info <node> <bone>}"
  local bone_name="${2:?Usage: qdbg bone-info <node> <bone>}"
  local safe_target="${target//\'/\\\'}"
  local safe_bone="${bone_name//\'/\\\'}"
  need_bridge
  qblock "
    var d = window.__quintusDebug;
    var snap = d.inspect('${safe_target}');
    if (!snap) snap = d.inspect(Number('${safe_target}'));
    if (!snap) return 'Node not found: ${safe_target}';

    var game = window.__quintusGame;
    var node = null;
    var stack = [game.currentScene];
    while (stack.length > 0) {
      var n = stack.pop();
      if (n.id === snap.id) { node = n; break; }
      var ch = n.children;
      for (var i = 0; i < ch.length; i++) stack.push(ch[i]);
    }
    if (!node || !node.object3d) return 'Node has no object3d';

    node.object3d.updateMatrixWorld(true);

    var bone = node.object3d.getObjectByName('${safe_bone}');
    if (!bone) return 'Bone not found: ${safe_bone}';

    var p = bone.position;
    var r = bone.rotation;
    var q = bone.quaternion;
    var s = bone.scale;
    var wm = bone.matrixWorld.elements;

    var childNames = [];
    for (var i = 0; i < bone.children.length; i++) {
      childNames.push(bone.children[i].name || bone.children[i].type || '(unnamed)');
    }

    return JSON.stringify({
      name: bone.name,
      type: bone.isBone ? 'Bone' : bone.type,
      parent: bone.parent ? (bone.parent.name || bone.parent.type) : null,
      localPosition: { x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4) },
      worldPosition: { x: +wm[12].toFixed(4), y: +wm[13].toFixed(4), z: +wm[14].toFixed(4) },
      rotation: { x: +r.x.toFixed(4), y: +r.y.toFixed(4), z: +r.z.toFixed(4), order: r.order },
      quaternion: { x: +q.x.toFixed(4), y: +q.y.toFixed(4), z: +q.z.toFixed(4), w: +q.w.toFixed(4) },
      scale: { x: +s.x.toFixed(4), y: +s.y.toFixed(4), z: +s.z.toFixed(4) },
      visible: bone.visible,
      children: childNames
    }, null, 2);
  "
}
```

**Note on animation state:** Bone transforms change per-animation. To read transforms during a specific animation (e.g., `holding-right`), ensure that animation is playing before calling `bone-info`. After `qdbg connect` + `step 60`, verify the animation is active via `qdbg inspect PlayerCharacter` before reading bone transforms.

### Dispatch Registration

Add to the case statement in `bin/qdbg` (~line 647):

```bash
bones)        check_playwright_cli; cmd_bones "$@" ;;
bone-info)    check_playwright_cli; cmd_bone_info "$@" ;;
```

### Tests

No automated tests for qdbg bash commands (consistent with existing commands). Verify manually:

1. `pnpm qdbg connect 3d-dungeon`
2. `pnpm qdbg step 60` (let scene load)
3. `pnpm qdbg bones PlayerCharacter` → should show bone tree with `arm-right`
4. `pnpm qdbg bone-info PlayerCharacter arm-right` → should show local/world transforms

---

## Phase 2: `BoneAttachment` Engine Primitive

Add a `BoneAttachment` class to `@quintus/three` that declaratively attaches to a named bone in a parent `GLTFModel`. This replaces manual `bone.add(model)` calls with a proper scene-tree node.

- [ ] Add `_boneParented` flag to `Node3D` (`packages/three/src/node3d.ts`)
- [ ] Update `ThreeLayer._syncNode()` to skip bone-parented nodes (`packages/three/src/three-layer.ts`)
- [ ] Create `packages/three/src/bone-attachment.ts`
- [ ] Export from `packages/three/src/index.ts`
- [ ] Add tests in `packages/three/src/bone-attachment.test.ts`
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes

### Design: Reparent to Bone, Not Matrix Hacking

The key insight: we want Three.js to do the transform math for us. When an Object3D is a child of a bone, it inherits the bone's world transform automatically — that's exactly what `bone.add()` does, and it's how Three.js is designed to work.

The complication is `ThreeLayer._syncNode()` (`packages/three/src/three-layer.ts:64-76`):

```typescript
private _syncNode(node: Node, parent: THREE.Object3D): void {
    if (node instanceof Node3D) {
        if (node.object3d.parent !== parent) {
            parent.add(node.object3d);  // ← would steal us back from the bone!
        }
        // ...
    }
}
```

Every frame, ThreeLayer checks that each Node3D's `object3d.parent` matches the expected Quintus parent's `object3d`. If BoneAttachment reparents to a bone, ThreeLayer will detect the mismatch and move it back.

**Solution:** Add a lightweight opt-out flag to `Node3D`:

```typescript
// packages/three/src/node3d.ts

export class Node3D extends Node {
    /**
     * When true, ThreeLayer will not manage this node's object3d parent.
     * Used by BoneAttachment to reparent object3d onto a skeleton bone
     * while keeping the node in the Quintus scene tree.
     * @internal
     */
    _boneParented = false;

    // ... rest unchanged ...
}
```

```typescript
// packages/three/src/three-layer.ts, _syncNode()

private _syncNode(node: Node, parent: THREE.Object3D): void {
    if (node instanceof Node3D) {
        if (!node._boneParented && node.object3d.parent !== parent) {
            parent.add(node.object3d);
        }
        for (const child of node.children) {
            this._syncNode(child, node.object3d);
        }
    } else {
        for (const child of node.children) {
            this._syncNode(child, parent);
        }
    }
}
```

This is a 2-line change to ThreeLayer, zero risk to existing behavior (flag defaults to `false`).

### `BoneAttachment` Class

With the opt-out flag, BoneAttachment becomes very simple — no matrix math, no per-frame updates:

```typescript
// packages/three/src/bone-attachment.ts

import * as THREE from "three";
import { GLTFModel } from "./gltf-model.js";
import { Node3D } from "./node3d.js";

/**
 * Attaches to a named bone in a parent GLTFModel. Children of this node
 * move with the bone automatically via Three.js parent/child transforms.
 *
 * Similar to Godot's BoneAttachment3D.
 *
 * Usage:
 * ```typescript
 * const grip = player.add(BoneAttachment, {
 *     boneName: "arm-right",
 *     offset: new THREE.Vector3(0, -0.15, 0), // shoulder-to-hand
 * });
 * grip.add(GLTFModel, { src: "weapon-sword" });
 * ```
 *
 * The offset is in bone-local space. For rigs with a dedicated hand bone,
 * no offset is needed. Use `qdbg bones <node>` to inspect the skeleton
 * and determine the correct bone name and offset.
 */
export class BoneAttachment extends Node3D {
    /** Name of the bone to attach to (e.g., "arm-right", "hand-right"). */
    boneName = "";

    /**
     * Offset from the bone origin in bone-local space.
     * Only needed when the bone origin doesn't match the desired attachment
     * point (e.g., shoulder bone when you want the hand position).
     */
    offset = new THREE.Vector3();

    /**
     * Rotation offset in bone-local space.
     * Use when the attached model's default orientation doesn't match
     * the bone's coordinate system.
     */
    offsetRotation = new THREE.Euler();

    private _bone: THREE.Object3D | null = null;

    override onReady(): void {
        this._resolve();
    }

    /**
     * Re-resolve the bone attachment. Call this if the target model
     * is reloaded or the bone name changes at runtime.
     */
    resolve(): void {
        this._resolve();
    }

    private _resolve(): void {
        if (!this.boneName) return;

        const model = this._findParentModel();
        if (!model?.loaded) return;

        this._bone = model.findBone(this.boneName);
        if (!this._bone) {
            console.warn(
                `BoneAttachment: bone "${this.boneName}" not found in `
                + `"${model.src}". Use \`qdbg bones ${model.constructor.name}\` `
                + `to inspect available bones.`,
            );
            return;
        }

        // Reparent our object3d from the Quintus-managed parent onto the bone.
        // Three.js bone transforms will flow naturally to our children.
        this._bone.add(this.object3d);
        this._boneParented = true;

        // Apply offset in bone-local space
        this.object3d.position.copy(this.offset);
        this.object3d.rotation.copy(this.offsetRotation);
    }

    override onExitTree(): void {
        // Clean up: remove from bone when leaving the scene
        if (this._bone && this.object3d.parent === this._bone) {
            this._bone.remove(this.object3d);
        }
        this._boneParented = false;
        this._bone = null;
        super.onExitTree();
    }

    private _findParentModel(): GLTFModel | null {
        let node = this.parent;
        while (node) {
            if (node instanceof GLTFModel) {
                return node;
            }
            node = node.parent;
        }
        return null;
    }
}
```

### Why This Approach Works

1. **No matrix math** — Three.js handles all transform propagation. Bone moves → Object3D moves → children move.
2. **No per-frame update** — `onReady()` reparents once, then Three.js does the work every render.
3. **No mock extensions needed** — tests don't exercise Matrix4 operations. The mock `Object3D.add()` and `getObjectByName()` already exist.
4. **No fight with ThreeLayer** — the `_boneParented` flag opts out of automatic reparenting.
5. **Visible in scene tree** — `qdbg tree` shows BoneAttachment and its children. `qdbg inspect BoneAttachment` shows its transform.
6. **Proper lifecycle** — `onExitTree()` cleans up the bone attachment. Destroying the player destroys the attachment.
7. **Uses `instanceof`** — no fragile duck-typing for finding the parent model.

### Scene Tree (Quintus vs Three.js)

```
Quintus Scene Tree:                    Three.js Object3D Tree:

Scene (DungeonLevel)                   threeScene
├── DungeonGrid                        ├── DungeonGrid.object3d
├── PlayerCharacter                    ├── PlayerCharacter.object3d
│   ├── BoneAttachment                 │   └── character-human (clone)
│   │   └── GLTFModel (sword)          │       └── root → torso → arm-right
│   └── CameraOrbit                    │           └── BoneAttachment.object3d  ← reparented!
│       └── Camera3D                   │               └── weapon-sword (clone)
└── HUD                                ├── CameraOrbit.object3d
                                       │   └── Camera3D.object3d
                                       └── HUD
```

BoneAttachment lives under PlayerCharacter in the Quintus tree (for lifecycle), but under `arm-right` bone in the Three.js tree (for transforms). This split is the whole point.

### Tests

**`packages/three/src/bone-attachment.test.ts`:**

```typescript
describe("BoneAttachment", () => {
    it("finds bone in parent GLTFModel and reparents object3d");
    it("sets _boneParented flag to true after resolve");
    it("applies offset as object3d.position in bone-local space");
    it("applies offsetRotation as object3d.rotation");
    it("warns when bone name not found");
    it("cleans up bone reference on exit tree");
    it("does nothing when boneName is empty");
});
```

**`packages/three/src/three-layer.test.ts` (new or extend existing):**

```typescript
describe("ThreeLayer _syncNode with bone-parented nodes", () => {
    it("does not reparent Node3D when _boneParented is true");
    it("still recurses into bone-parented node's children");
});
```

Tests use the existing mock infrastructure. No Matrix4 extensions needed — the tests verify that `bone.add(object3d)` was called and that the position/rotation are set correctly.

---

## Phase 3: Fix Sword Attachment in 3D Dungeon

Replace the manual `bone.add()` in PlayerCharacter with `BoneAttachment`. Use `qdbg bones` to determine the correct offset.

- [ ] Replace sword attachment code in `PlayerCharacter.onReady()` with `BoneAttachment`
- [ ] Use `qdbg bones` to verify bone hierarchy and determine offset
- [ ] Verify sword position with `qdbg screenshot` from multiple camera angles
- [ ] All existing tests pass (31 tests in 3d-dungeon)
- [ ] Remove `SkeletonUtils` import from player.ts (no longer needed for sword)

### Current Code (to be replaced)

```typescript
// examples/3d-dungeon/entities/player.ts, onReady()
const armRight = this.findBone("arm-right");
const swordGltf = this.game.assets.get<GLTF>("weapon-sword");
if (armRight && swordGltf) {
    const swordModel = SkeletonUtils.clone(swordGltf.scene);
    swordModel.position.set(0, -0.08, -0.05);
    armRight.add(swordModel);
}
```

Problems: manual Three.js parenting, invisible to engine, guessed offset, requires SkeletonUtils import.

### Target Code

```typescript
// examples/3d-dungeon/entities/player.ts, onReady()

// Attach sword to right hand. arm-right bone is at the shoulder;
// offset (0, -0.15, 0) moves to the hand along bone-local -Y.
// Determined via: qdbg bones PlayerCharacter
this.add(BoneAttachment, {
    boneName: "arm-right",
    offset: new THREE.Vector3(0, -0.15, 0),
}).add(GLTFModel, { src: "weapon-sword" });
```

The offset `(0, -0.15, 0)` is the arm length — the distance from the `arm-right` bone origin (shoulder) to the hand endpoint. This is a physical property of the character rig, discoverable via `qdbg bones`, not a magic number. The comment documents its origin.

### Verification Workflow

```bash
# 1. Connect and load scene
pnpm qdbg connect 3d-dungeon
pnpm qdbg step 60

# 2. Inspect bone hierarchy to verify/adjust offset
pnpm qdbg bones PlayerCharacter
# → arm-right at world(0.900, 0.288, 2.988)
# → arm length ~0.15 along bone-local -Y

# 3. Verify animation is playing
pnpm qdbg inspect PlayerCharacter
# → check animation state shows "holding-right"

# 4. Check from multiple angles
pnpm qdbg screenshot sword-front.png
pnpm qdbg tap camera_left 1
pnpm qdbg step 30
pnpm qdbg screenshot sword-side.png

# 5. Test attack animation
pnpm qdbg tap interact 1
pnpm qdbg step 10
pnpm qdbg screenshot sword-attack.png
```

### Note on Models With Hand Bones

For higher-fidelity character rigs that include dedicated hand bones (e.g., `hand-right`, `grip-right`), the offset would be `(0, 0, 0)` — just attach to the hand bone directly:

```typescript
// Zero offset — the bone IS the attachment point
this.add(BoneAttachment, { boneName: "hand-right" })
    .add(GLTFModel, { src: "weapon-sword" });
```

The Kenney mini-dungeon models use a simplified 7-bone rig where `arm-right` covers shoulder-to-hand as a single bone, so the offset is necessary. This is a common pattern in low-poly game assets.

---

## Definition of Done

- [ ] `qdbg bones <node>` displays full Object3D tree with bone markers and world positions
- [ ] `qdbg bone-info <node> <bone>` displays detailed transform for a single bone
- [ ] `BoneAttachment` class exists in `@quintus/three` with tests
- [ ] `_boneParented` flag on Node3D, respected by ThreeLayer
- [ ] 3D dungeon sword uses `BoneAttachment` and is visually positioned at the player's hand
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes (including new `bone-attachment.test.ts`)
- [ ] `pnpm lint` clean
- [ ] `qdbg bones PlayerCharacter` works in a live debug session
