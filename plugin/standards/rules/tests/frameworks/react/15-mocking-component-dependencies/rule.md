---
summary: "What a component test mocks."
checked: false
severity: advisory
---

## Mocking Component Dependencies

**Hooks** mock like any other function (`test-mock-untyped`, `test-mock-wrapper-untyped`):

```typescript
const mockUseProjects = jest.fn<(params: { workspaceId: number }) => { data: Project[] }>();

jest.mock('@/features/projects/hooks/useProjects', () => ({
	useProjects: (params: { workspaceId: number }) => mockUseProjects(params),
}));
```

**Zustand-style stores**: `mockUseAppStore.mockReturnValue(value)` works only when the component calls the store **once**. When it reads multiple slices, run the real selectors against a mock state instead:

```typescript
const setupFeaturePanel = ({ isActive = true, label = 'Panel' }: { isActive?: boolean; label?: string } = {}) => {
	mockUseAppStore.mockImplementation((selector) => selector({ isActive, label }));
	render(<FeaturePanel />);
};
```

**Child components**: mock a child **only if it is itself a boundary** (its own module, or imported from another feature). Render **real** internal children (under this module's own `common/`) so they are covered through this boundary's tests — mocking an internal child leaves it with no coverage at all. When you do mock a boundary child, keep it minimal: just enough to verify props and conditional rendering.
