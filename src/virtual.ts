import { isVite2, normalizePath } from "./utils";

export function createVirtualModuleID(name: string) {
  const virtualModuleId = `virtual:${name}`;
  const resolvedVirtualModuleId = "\0" + virtualModuleId;
  return {
    virtualModuleId,
    resolvedVirtualModuleId,
  };
}

export async function createVirtualGlob(
  target: string,
  isSync: boolean,
) {
  const g = `"${target}/**/*.vue"`;
  if (await isVite2()) {
    return isSync ? `import.meta.globEager(${g})` : `import.meta.glob(${g})`;
  }
  return `import.meta.glob(${g}, { eager: ${isSync} })`;
}

interface VirtualModuleCodeOptions {
  target: string;
  defaultLayout: string;
  importMode: "sync" | "async";
}

export async function createVirtualModuleCode(
  options: VirtualModuleCodeOptions,
) {
  const { target, defaultLayout, importMode } = options;

  const normalizedTarget = normalizePath(target);

  const isSync = importMode === "sync";

  return `
export function createGetRoutes(router, withLayout = false) {
	const routes = router.getRoutes()
	if (withLayout) {
		return routes
	}
	return () => routes.filter(route => !route.meta.isLayout)
}

export function setupLayouts(routes) {
	const layouts = {}

	const modules = ${await createVirtualGlob(
    normalizedTarget,
    isSync,
  )}
  
	Object.entries(modules).forEach(([name, module]) => {
		let key = name.replace("${normalizedTarget}/", '').replace('.vue', '')
		layouts[key] = ${isSync ? "module.default" : "module"}
	})
	
  function deepSetupLayout(routes, top = true) {
    return routes.map(route => {
      if (route.children?.length > 0) {
        route.children = deepSetupLayout(route.children, false)
      }
      
      if (top) {
        return { 
          path: route.path,
          component: layouts[route.meta?.layout || '${defaultLayout}'],
          children: [ {...route, path: ''} ],
          meta: {
            isLayout: true
          }
        }
      }

      if (route.meta?.layout) {
        return { 
          path: route.path,
          component: layouts[route.meta?.layout],
          children: [ {...route, path: ''} ],
          meta: {
            isLayout: true
          }
        }
      }

      return route
    })
  }

	return deepSetupLayout(routes)
}`;
}
