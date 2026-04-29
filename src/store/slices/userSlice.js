import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as userService from "../../services/userService";

export const fetchUsers = createAsyncThunk(
  "users/fetchUsers",
  async ({ page, size } = {}, thunkAPI) => {
    try {
      return await userService.listUsers({ page, size });
    } catch (error) {
      return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "FETCH_FAILED");
    }
  },
  {
    condition: (_, { getState }) => {
      const { loading, items } = getState().users;
      return !loading && items.length === 0;
    },
  }
);

export const fetchUser = createAsyncThunk("users/fetchUser", async (id, thunkAPI) => {
  try {
    return await userService.getUser(id);
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "FETCH_FAILED");
  }
});

export const createUser = createAsyncThunk("users/createUser", async (payload, thunkAPI) => {
  try {
    return await userService.createUser(payload);
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "CREATE_FAILED");
  }
});

export const inviteUser = createAsyncThunk("users/inviteUser", async (payload, thunkAPI) => {
  try {
    return await userService.inviteUser(payload);
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "INVITE_FAILED");
  }
});

export const updateUser = createAsyncThunk("users/updateUser", async ({ id, fullName }, thunkAPI) => {
  try {
    return await userService.updateUser(id, { fullName });
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "UPDATE_FAILED");
  }
});

export const deleteUser = createAsyncThunk("users/deleteUser", async (id, thunkAPI) => {
  try {
    await userService.deleteUser(id);
    return id;
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "DELETE_FAILED");
  }
});

export const reviveUser = createAsyncThunk("users/reviveUser", async (id, thunkAPI) => {
  try {
    return await userService.reviveUser(id);
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "REVIVE_FAILED");
  }
});

export const fetchUserRoles = createAsyncThunk("users/fetchUserRoles", async (userId, thunkAPI) => {
  try {
    const roles = await userService.getUserRoles(userId);
    return { userId, roles };
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "FETCH_FAILED");
  }
});

export const assignRole = createAsyncThunk("users/assignRole", async ({ userId, roleId }, thunkAPI) => {
  try {
    await userService.assignRole(userId, roleId);
    return { userId, roleId };
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "ASSIGN_FAILED");
  }
});

export const revokeRole = createAsyncThunk("users/revokeRole", async ({ userId, roleId }, thunkAPI) => {
  try {
    await userService.revokeRole(userId, roleId);
    return { userId, roleId };
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "REVOKE_FAILED");
  }
});

const userSlice = createSlice({
  name: "users",
  initialState: {
    items: [],
    page: 0,
    totalItems: 0,
    totalPages: 1,
    hasNext: false,
    userRoles: {},   // { [userId]: role[] }
    loading: false,
    error: null,
    errorCode: null,
  },
  reducers: {
    clearUserError(state) {
      state.error = null;
      state.errorCode = null;
    },
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; state.errorCode = null; };
    const rejected = (state, action) => { state.loading = false; state.errorCode = action.payload; };

    builder
      .addCase(fetchUsers.pending, pending)
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        const { items, page, totalItems, totalPages, hasNext } = action.payload;
        state.items = items;
        state.page = page;
        state.totalItems = totalItems;
        state.totalPages = totalPages;
        state.hasNext = hasNext;
      })
      .addCase(fetchUsers.rejected, rejected)

      .addCase(createUser.pending, pending)
      .addCase(createUser.fulfilled, (state, action) => {
        state.loading = false;
        state.items.unshift(action.payload);
        state.totalItems += 1;
      })
      .addCase(createUser.rejected, rejected)

      .addCase(inviteUser.pending, pending)
      .addCase(inviteUser.fulfilled, (state, action) => {
        state.loading = false;
        state.items.unshift(action.payload);
        state.totalItems += 1;
      })
      .addCase(inviteUser.rejected, rejected)

      .addCase(updateUser.pending, pending)
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false;
        const idx = state.items.findIndex((u) => u.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(updateUser.rejected, rejected)

      .addCase(deleteUser.pending, pending)
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.loading = false;
        // Mark as inactive rather than remove — mirrors soft-delete
        const idx = state.items.findIndex((u) => u.id === action.payload);
        if (idx !== -1) state.items[idx].status = "inactive";
      })
      .addCase(deleteUser.rejected, rejected)

      .addCase(reviveUser.pending, pending)
      .addCase(reviveUser.fulfilled, (state, action) => {
        state.loading = false;
        const idx = state.items.findIndex((u) => u.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(reviveUser.rejected, rejected)

      .addCase(fetchUserRoles.fulfilled, (state, action) => {
        state.userRoles[action.payload.userId] = action.payload.roles;
      })
      .addCase(revokeRole.fulfilled, (state, action) => {
        const { userId, roleId } = action.payload;
        if (state.userRoles[userId]) {
          state.userRoles[userId] = state.userRoles[userId].filter((r) => r.id !== roleId);
        }
      });
  },
});

export const { clearUserError } = userSlice.actions;
export default userSlice.reducer;
