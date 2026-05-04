import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as orgService from "../../services/orgService";

export const fetchOrgs = createAsyncThunk(
  "orgs/fetchOrgs",
  async (_, thunkAPI) => {
    try {
      return await orgService.listOrgs();
    } catch (error) {
      return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "FETCH_FAILED");
    }
  },
  {
    condition: (_, { getState }) => !getState().orgs.loading,
  }
);

export const fetchOrg = createAsyncThunk("orgs/fetchOrg", async (id, thunkAPI) => {
  try {
    return await orgService.getOrg(id);
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "FETCH_FAILED");
  }
});

export const createOrg = createAsyncThunk("orgs/createOrg", async (payload, thunkAPI) => {
  try {
    return await orgService.createOrg(payload);
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "CREATE_FAILED");
  }
});

export const updateOrg = createAsyncThunk("orgs/updateOrg", async ({ id, name }, thunkAPI) => {
  try {
    return await orgService.updateOrg(id, { name });
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "UPDATE_FAILED");
  }
});

export const suspendOrg = createAsyncThunk("orgs/suspendOrg", async (id, thunkAPI) => {
  try {
    return await orgService.suspendOrg(id);
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "SUSPEND_FAILED");
  }
});

export const activateOrg = createAsyncThunk("orgs/activateOrg", async (id, thunkAPI) => {
  try {
    return await orgService.activateOrg(id);
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "ACTIVATE_FAILED");
  }
});

export const deleteOrg = createAsyncThunk("orgs/deleteOrg", async (id, thunkAPI) => {
  try {
    await orgService.deleteOrg(id);
    return id;
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "DELETE_FAILED");
  }
});

const orgSlice = createSlice({
  name: "orgs",
  initialState: {
    orgs: [],
    selectedOrg: null,        // result of GET /orgs/{id}
    selectedOrgLoading: false,
    selectedOrgError: null,
    loading: false,
    error: null,
    errorCode: null,
  },
  reducers: {
    clearOrgError(state) {
      state.error = null;
      state.errorCode = null;
    },
    clearSelectedOrg(state) {
      state.selectedOrg = null;
      state.selectedOrgError = null;
    },
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; state.errorCode = null; };
    const rejected = (state, action) => { state.loading = false; state.errorCode = action.payload; };

    const upsert = (state, updated) => {
      const idx = state.orgs.findIndex((o) => o.id === updated.id);
      if (idx !== -1) state.orgs[idx] = updated;
    };

    builder
      .addCase(fetchOrgs.pending, pending)
      .addCase(fetchOrgs.fulfilled, (state, action) => {
        state.loading = false;
        state.orgs = action.payload;
      })
      .addCase(fetchOrgs.rejected, rejected)

      // GET /orgs/{id}
      .addCase(fetchOrg.pending, (state) => {
        state.selectedOrgLoading = true;
        state.selectedOrgError = null;
      })
      .addCase(fetchOrg.fulfilled, (state, action) => {
        state.selectedOrgLoading = false;
        state.selectedOrg = action.payload;
        // also keep the list in sync
        upsert(state, action.payload);
      })
      .addCase(fetchOrg.rejected, (state, action) => {
        state.selectedOrgLoading = false;
        state.selectedOrgError = action.payload;
      })

      .addCase(createOrg.pending, pending)
      .addCase(createOrg.fulfilled, (state, action) => {
        state.loading = false;
        state.orgs.unshift(action.payload);
      })
      .addCase(createOrg.rejected, rejected)

      .addCase(updateOrg.pending, pending)
      .addCase(updateOrg.fulfilled, (state, action) => { state.loading = false; upsert(state, action.payload); })
      .addCase(updateOrg.rejected, rejected)

      .addCase(suspendOrg.pending, pending)
      .addCase(suspendOrg.fulfilled, (state, action) => { state.loading = false; upsert(state, action.payload); })
      .addCase(suspendOrg.rejected, rejected)

      .addCase(activateOrg.pending, pending)
      .addCase(activateOrg.fulfilled, (state, action) => { state.loading = false; upsert(state, action.payload); })
      .addCase(activateOrg.rejected, rejected)

      .addCase(deleteOrg.pending, pending)
      .addCase(deleteOrg.fulfilled, (state, action) => {
        state.loading = false;
        // Soft-delete — mark inactive rather than remove from list
        const idx = state.orgs.findIndex((o) => o.id === action.payload);
        if (idx !== -1) state.orgs[idx].status = "inactive";
      })
      .addCase(deleteOrg.rejected, rejected);
  },
});

export const { clearOrgError, clearSelectedOrg } = orgSlice.actions;
export default orgSlice.reducer;
