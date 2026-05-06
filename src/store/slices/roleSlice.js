import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as roleService from "../../services/roleService";

export const fetchPermissions = createAsyncThunk(
  "roles/fetchPermissions",
  async (_, thunkAPI) => {
    try {
      return await roleService.listPermissions();
    } catch (error) {
      return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "FETCH_FAILED");
    }
  },
  {
    condition: (_, { getState }) => {
      const s = getState().roles;
      return !s.permissionsLoading && s.permissions.length === 0;
    },
  }
);

export const fetchRoles = createAsyncThunk(
  "roles/fetchRoles",
  async (_, thunkAPI) => {
    try {
      return await roleService.listRoles();
    } catch (error) {
      return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "FETCH_FAILED");
    }
  },
  {
    condition: (_, { getState }) => {
      const s = getState().roles;
      return !s.loading && s.roles.length === 0;
    },
  }
);

export const createRole = createAsyncThunk("roles/createRole", async (name, thunkAPI) => {
  try {
    return await roleService.createRole(name);
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "CREATE_FAILED");
  }
});

export const renameRole = createAsyncThunk("roles/renameRole", async ({ id, name }, thunkAPI) => {
  try {
    return await roleService.renameRole(id, name);
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "UPDATE_FAILED");
  }
});

export const deleteRole = createAsyncThunk("roles/deleteRole", async (id, thunkAPI) => {
  try {
    await roleService.deleteRole(id);
    return id;
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "DELETE_FAILED");
  }
});

export const addPermissionToRole = createAsyncThunk("roles/addPermission", async ({ roleId, permissionId }, thunkAPI) => {
  try {
    return await roleService.addPermissionToRole(roleId, permissionId);
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "UPDATE_FAILED");
  }
});

export const removePermissionFromRole = createAsyncThunk("roles/removePermission", async ({ roleId, permId }, thunkAPI) => {
  try {
    return await roleService.removePermissionFromRole(roleId, permId);
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "UPDATE_FAILED");
  }
});

const roleSlice = createSlice({
  name: "roles",
  initialState: {
    roles: [],
    permissions: [],   // all system permission definitions
    loading: false,
    permissionsLoading: false,
    error: null,
    errorCode: null,
  },
  reducers: {
    clearRoleError(state) {
      state.error = null;
      state.errorCode = null;
    },
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; state.errorCode = null; };
    const rejected = (state, action) => { state.loading = false; state.errorCode = action.payload; };

    builder
      .addCase(fetchPermissions.pending, (state) => { state.permissionsLoading = true; state.errorCode = null; })
      .addCase(fetchPermissions.fulfilled, (state, action) => {
        state.permissionsLoading = false;
        state.permissions = action.payload;
      })
      .addCase(fetchPermissions.rejected, (state) => { state.permissionsLoading = false; })

      .addCase(fetchRoles.pending, pending)
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.loading = false;
        state.roles = action.payload;
      })
      .addCase(fetchRoles.rejected, rejected)

      .addCase(createRole.pending, pending)
      .addCase(createRole.fulfilled, (state, action) => {
        state.loading = false;
        state.roles.push(action.payload);
      })
      .addCase(createRole.rejected, rejected)

      .addCase(renameRole.pending, pending)
      .addCase(renameRole.fulfilled, (state, action) => {
        state.loading = false;
        const idx = state.roles.findIndex((r) => r.id === action.payload.id);
        if (idx !== -1) state.roles[idx] = action.payload;
      })
      .addCase(renameRole.rejected, rejected)

      .addCase(deleteRole.pending, pending)
      .addCase(deleteRole.fulfilled, (state, action) => {
        state.loading = false;
        state.roles = state.roles.filter((r) => r.id !== action.payload);
      })
      .addCase(deleteRole.rejected, rejected)

      // Both add/remove return the updated role object
      .addCase(addPermissionToRole.fulfilled, (state, action) => {
        const idx = state.roles.findIndex((r) => r.id === action.payload.id);
        if (idx !== -1) state.roles[idx] = action.payload;
      })
      .addCase(removePermissionFromRole.fulfilled, (state, action) => {
        const idx = state.roles.findIndex((r) => r.id === action.payload.id);
        if (idx !== -1) state.roles[idx] = action.payload;
      });
  },
});

export const { clearRoleError } = roleSlice.actions;
export default roleSlice.reducer;
